
export const config = {

    db: {
        host: 'localhost',
        database: 'quant_ts',
        username: 'quant',
        password: 'quant',
    },

    log: {
        file: './logs/quant.log'
    },


    notifier: {
        dingding: {
            webhook: 'https://oapi.dingtalk.com/robot/send?access_token=12345678',
            mobiles: ['12345678']
        }
    },

    messagePoolAliveCheckInterval: 1000 * 40,

    grid: {
        taskCheckInterval: 1000 * 60 * 1
    }
}
