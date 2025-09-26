const Base = require('./base.js');
const path = require('path');

const time = () => Date.now() / 1000;
let retry_time = 0;
let retry_times = 5;

class Setting extends Base
{
    actions = {install: '系统安装', login: '账户登录', index: '系统设置', add: '添加push_key', delete: '删除push_key', list: '获取push_key列表'};
    buttons = {install: '安装', login: '登录', index: '设置', add: '添加', delete: '删除', list: '列表'};

    async _init() {
        super._init();
        this.$assign('actions', this.actions);
        this.$assign('buttons', this.buttons);
        this.$assign('cur_nav', 'setting');
    }

    async index() {
        if(!this.$config.setting) {
            if(this._isApiRequest()) {
                return this._jsonError('系统未安装！', 503);
            }
            return this.$redirect('install');
        }

        if(!this._isLogin()) {
            if(this._isApiRequest()) {
                return this._jsonError('未登录或admin_token无效！', 401);
            }
            return this.$redirect('login');
        }

        if(this.$request.isGet() && !this._isApiRequest()) {
            const push_key = this.$config.setting.push_keys.join(',');
            const admin_token = this.$config.setting.admin_token || '';
            this.$assign('push_key', push_key);
            this.$assign('admin_token', admin_token);
            this.$assign('action', 'index');
            return this.$fetch();
        }
        
        const push_key = this._parsePushkey(this.$request.query('push_key'));
        const admin_token = this.$request.query('admin_token') || this.$config.setting.admin_token || '';
        const user = this.$config.setting.user;
        const password = this.$config.setting.password;
        await this._writeSettingFile(push_key, user, password, admin_token);

        if(this._isApiRequest()) {
            return this._jsonSuccess('保存成功！', {
                push_keys: this.$config.setting.push_keys,
                admin_token
            });
        }

        this.$success('保存成功！');
    }

    async login() {
        if(this.$request.isGet()) {
            this.$assign('action', 'login');
            return this.$fetch('index');
        }

        if(retry_time > time()) {
            let delay_time = Math.floor(retry_time - time());
            let delay_str = '';
            if(delay_time >= 60) {
                delay_str += Math.floor(delay_time / 60) + '分钟';
                delay_time = delay_time % 60;
            }
            delay_str += Math.floor(delay_time) + '秒';
            return this.$error(`请${delay_str}后再试！`);
        }

        let user = this.$request.query('user');
        let password = this.$request.query('password');
        user = this._md5(user);
        password = this._md5(password);
        if(user != this.$config.setting.user || password != this.$config.setting.password) {
            retry_times--;
            if(retry_times > 0) {
                return this.$error(`账号或密码错误！${retry_times <= 3 ? '还剩' + retry_times + '机会' : ''}`);
            } else {
                retry_times = 5;
                retry_time = time() + 3 * 60;
                return this.$error(`账号或密码错误！请稍后再试`);
            }
        }

        this.$cookie.set('user', this.$request.query('user'));
        this.$success('登录成功！', 'index');
    }

    async logout() {
        this.$cookie.delete('user');
        this.$success('退出成功！', 'index');
    }

    async install() {
        if(this.$config.setting) { 
            return this.$redirect('index');
        }

        if(this.$request.isGet()) {
            this.$assign('action', 'install');
            return this.$fetch('index');
        }

        const push_key = this._parsePushkey(this.$request.query('push_key'));
        const admin_token = this.$request.query('admin_token') || this._generateToken();
        let user = this.$request.query('user');
        let password = this.$request.query('password');
        if(user == '' || password == '') {
            return this.$error('账号或密码不能为空！');
        }
        user = this._md5(user);
        password = this._md5(password);
        await this._writeSettingFile(push_key, user, password, admin_token);

        this.$success('安装成功！', 'index');
    }

    _parsePushkey(push_key) {
        push_key = push_key.replace(/ /g, '').replace(/,/g, "', '");
        return `'${push_key}'`;
    }

    async add() {
        if(!this.$config.setting) {
            return this._jsonError('系统未安装！');
        }

        // 支持两种鉴权方式：登录用户或admin_token
        if(!this._isLogin() && !this._isValidToken()) {
            return this._jsonError('请先登录或提供有效的admin_token！');
        }

        const push_key = this.$request.query('push_key');
        if(!push_key || typeof push_key !== 'string') {
            return this._jsonError('push_key参数不能为空且必须为字符串！');
        }

        // 检查push_key格式（简单验证，可根据需要调整）
        if(push_key.length < 3 || push_key.length > 50) {
            return this._jsonError('push_key长度必须在3-50个字符之间！');
        }

        // 检查是否已存在
        if(this.$config.setting.push_keys.includes(push_key)) {
            return this._jsonError('push_key已存在！');
        }

        // 添加新的push_key
        const new_push_keys = [...this.$config.setting.push_keys, push_key];
        const push_keys_str = new_push_keys.map(key => `'${key}'`).join(', ');
        const user = this.$config.setting.user;
        const password = this.$config.setting.password;
        const admin_token = this.$config.setting.admin_token;

        await this._writeSettingFile(push_keys_str, user, password, admin_token);
        return this._jsonSuccess('push_key添加成功！', {push_key: push_key});
    }

    async delete() {
        if(!this.$config.setting) {
            return this._jsonError('系统未安装！');
        }

        // 支持两种鉴权方式：登录用户或admin_token
        if(!this._isLogin() && !this._isValidToken()) {
            return this._jsonError('请先登录或提供有效的admin_token！');
        }

        const push_key = this.$request.query('push_key');
        if(!push_key || typeof push_key !== 'string') {
            return this._jsonError('push_key参数不能为空且必须为字符串！');
        }

        // 检查push_key是否存在
        if(!this.$config.setting.push_keys.includes(push_key)) {
            return this._jsonError('push_key不存在！');
        }

        // 检查是否为最后一个push_key
        if(this.$config.setting.push_keys.length === 1) {
            return this._jsonError('不能删除最后一个push_key！');
        }

        // 删除push_key
        const new_push_keys = this.$config.setting.push_keys.filter(key => key !== push_key);
        const push_keys_str = new_push_keys.map(key => `'${key}'`).join(', ');
        const user = this.$config.setting.user;
        const password = this.$config.setting.password;
        const admin_token = this.$config.setting.admin_token;

        await this._writeSettingFile(push_keys_str, user, password, admin_token);
        return this._jsonSuccess('push_key删除成功！', {push_key: push_key});
    }

    async list() {
        if(!this.$config.setting) {
            return this._jsonError('系统未安装！');
        }

        // 支持两种鉴权方式：登录用户或admin_token
        if(!this._isLogin() && !this._isValidToken()) {
            return this._jsonError('请先登录或提供有效的admin_token！');
        }

        return this._jsonSuccess('获取push_key列表成功！', {
            push_keys: this.$config.setting.push_keys,
            count: this.$config.setting.push_keys.length
        });
    }

    // 验证admin_token是否有效
    _isValidToken() {
        const token = this.$request.query('admin_token') || this.$request.header('admin-token') || this.$request.header('authorization')?.replace('Bearer ', '');
        return token && this.$config.setting && this.$config.setting.admin_token && token === this.$config.setting.admin_token;
    }

    // 生成随机token
    _generateToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // JSON格式成功响应
    _jsonSuccess(message, data = null) {
        this.ctx.type = 'application/json';
        this.ctx.body = JSON.stringify({
            state: true,
            code: 200,
            msg: message,
            data: data
        });
    }

    // JSON格式错误响应
    _jsonError(message, code = 400) {
        this.ctx.type = 'application/json';
        this.ctx.body = JSON.stringify({
            state: false,
            code: code,
            msg: message,
            data: null
        });
    }

    async _writeSettingFile(push_key, user, password, admin_token = '') {
        const setting_str = `module.exports = {\n    push_keys: [${push_key}],\n    user: '${user}',\n    password: '${password}',\n    admin_token: '${admin_token}'\n};`;
        const setting_file = path.join(this.$config.app.base_dir, './config/setting.js');
        await require('fs/promises').writeFile(setting_file, setting_str);
        require.cache[setting_file] && delete(require.cache[setting_file]);
    }
}

module.exports = Setting;