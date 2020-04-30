
export  const config = {

    db : {
        database: 'quant_ts',
        username: 'quant',
        password: 'Ethereum1.8.27',
    },

    log: {
        file: './logs/quant.log' 
    },


    notifier: {
        dingding: {
            webhook: 'https://oapi.dingtalk.com/robot/send?access_token=bd4eade2351f0c8136f7a4a04cc77d7e1acb260f88da29418c286056bbeb35ef',
            mobiles: ['13120343530']
        }
    },

    messagePoolAliveCheckInterval: 1000 * 40,

    grid: {
        taskCheckInterval: 1000 * 60 * 1
    }
}
