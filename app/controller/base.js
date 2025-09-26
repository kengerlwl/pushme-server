const {Controller, utils} = require('jj.js');
const md5 = utils.md5;

class Base extends Controller
{
    _init() {
        const pkg = require('../../package.json');
        this.version = pkg.version;
        this.$assign('version', 'v' + pkg.version);
        this.$assign('is_login', this._isLogin());
    }

    _isLogin() {
        return this.$config.setting && this._md5(this.$cookie.get('user')) == this.$config.setting.user;
    }

    _md5(str, salt='pushme') {
        return md5(salt + md5(salt + md5(str + salt) + salt));
    }

    /**
     * 判断是否是API请求
     * 通过以下方式判断：
     * 1. Accept header 包含 application/json
     * 2. Content-Type 是 application/json
     * 3. 是 Ajax 请求
     * 4. URL 路径包含 /api/
     * 5. 请求参数中包含 is_api=1
     * @returns {boolean}
     */
    _isApiRequest() {
        const accept = this.$request.header('accept', '').toLowerCase();
        const contentType = this.$request.header('content-type', '').toLowerCase();
        const url = this.$request.url();

        // 检查 Accept header 是否包含 application/json
        if (accept.includes('application/json')) {
            return true;
        }

        // 检查 Content-Type 是否是 application/json
        if (contentType.includes('application/json')) {
            return true;
        }

        // 检查是否是 Ajax 请求
        if (this.$request.isAjax()) {
            return true;
        }

        // 检查 URL 路径是否包含 /api/
        if (url.includes('/api/')) {
            return true;
        }

        // 检查请求参数中是否包含 is_api=1
        if (this.$request.query('is_api') == '1') {
            return true;
        }

        return false;
    }
}

module.exports = Base;