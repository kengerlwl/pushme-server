const {App, Logger, utils} = require('jj.js');
const Aedes = require('aedes');

// PushMe server
const aedes = Aedes();
aedes.preConnect = function(client, packet, callback) {
    Logger.log('server', '[preConnect]', packet.clientId, 'keepalive:', packet.keepalive);

    // 优化keepalive设置，确保合理的心跳间隔
    if(packet.keepalive) {
        // 如果keepalive过长（超过300秒），调整为更合理的值
        if(packet.keepalive > 300) {
            packet.keepalive = 300; // 5分钟心跳
        }
        // 如果keepalive过短（小于30秒），调整为最小值
        else if(packet.keepalive < 30) {
            packet.keepalive = 30; // 30秒最小心跳
        }
    } else {
        // 如果客户端没有设置keepalive，使用默认值
        packet.keepalive = 60; // 1分钟默认心跳
    }

    Logger.log('server', '[preConnect]', packet.clientId, 'adjusted keepalive:', packet.keepalive);
    callback(null, true);
}
aedes.authorizeSubscribe = function(client, sub, callback) {
    // Logger.log('server', '[authorizeSubscribe]', client.id);
    let setting = {};
    try {
        setting = require('./config/setting.js');
    } catch(e) {}
    if(!sub.topic || !setting.push_keys || !setting.push_keys.includes(sub.topic)) {
        Logger.log('server', '[errorTopic]', sub.topic);
        return callback(new Error('errorTopic: ' + sub.topic));
    }
    callback(null, sub);
}

aedes.on('clientReady', function(client) {
    Logger.log('server', '[clientReady]', client.id, 'keepalive:', client.keepalive);
});

aedes.on('clientDisconnect', function(client) {
    Logger.log('server', '[clientDisconnect]', client.id, 'reason: client disconnect');
});

aedes.on('clientError', function (client, err) {
    Logger.log('server', '[clientError]', client.id, err.message);
});

// 添加更多连接监控事件
aedes.on('connectionError', function(client, err) {
    Logger.log('server', '[connectionError]', client ? client.id : 'unknown', err.message);
});

aedes.on('keepaliveTimeout', function(client) {
    Logger.log('server', '[keepaliveTimeout]', client.id, 'client keepalive timeout');
});

// 监控订阅事件
aedes.on('subscribe', function(subscriptions, client) {
    Logger.log('server', '[subscribe]', client.id, 'topics:', subscriptions.map(s => s.topic).join(','));
});

aedes.on('unsubscribe', function(unsubscriptions, client) {
    Logger.log('server', '[unsubscribe]', client.id, 'topics:', unsubscriptions.join(','));
});

const server = require('net').createServer(aedes.handle);
const server_port = 3100;

// 配置TCP服务器选项以提高连接稳定性
server.on('connection', function(socket) {
    Logger.log('server', '[TCP connection]', socket.remoteAddress + ':' + socket.remotePort);

    // 启用TCP keepAlive，检测死连接
    socket.setKeepAlive(true, 30000); // 30秒keepalive

    // 禁用Nagle算法，提高实时性
    socket.setNoDelay(true);

    // 设置连接超时
    socket.setTimeout(300000); // 5分钟超时

    socket.on('timeout', function() {
        Logger.log('server', '[TCP timeout]', socket.remoteAddress + ':' + socket.remotePort);
        socket.destroy();
    });

    socket.on('error', function(err) {
        Logger.log('server', '[TCP error]', socket.remoteAddress + ':' + socket.remotePort, err.message);
    });

    socket.on('close', function() {
        Logger.log('server', '[TCP close]', socket.remoteAddress + ':' + socket.remotePort);
    });
});

server.listen(server_port, function (err) {
    if(!err) {
        Logger.system('pushme server is started and listening on port', server_port);
    } else {
        Logger.error('pushme server error', err);
    }
});

// publish message
async function publish(topic, msg, qos = 1) {
    if(typeof msg == 'object') {
        if(!msg.date) {
            msg.date = utils.date.format('YYYY-mm-dd HH:ii:ss');
        }
        msg = JSON.stringify(msg);
    }
    return new Promise((resolve, reject) => {
        const packet = {
            topic,
            payload: Buffer.from(msg),
            qos
        };
        aedes.publish(packet, error => {
            const result = error ? 'fail' : 'success';
            Logger.log('server', '[publish]', msg, result);
            resolve(result);
        });
    });
}

// PushMe panel
const app = new App();
app.use(async(ctx, next) => {
    ctx.publish = publish;
    await next();
});
const panel_port = 3010;
const panelServer = app.listen(panel_port, function(err) {
    if(!err) {
        Logger.system('pushme panel is started and listening on port', panel_port);
    } else {
        Logger.error('pushme panel error', err);
    }
});

const ws = require('websocket-stream');
ws.createServer({server: panelServer}, aedes.handle);
Logger.system('websocket is started and listening on port', panel_port);