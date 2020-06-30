
export const MarketWebSocket = 'wss://api.huobi.pro/ws'

export const OP_ACCOUNTS = 'accounts'

export const REQ = 'req'
export const REQ_ACCOUNTS_LIST = 'accounts.list'
export const REQ_ORDER_DETAIL = 'orders.detail'

export const NOTIFY = 'notify'

export const PING = 'ping'
export const PONG = 'pong'

export const SUB = 'sub'

export const ERR_CODE = 'err-code'

export const AccountAPI = 'https://api.huobi.pro'

// export const AccountBalance = '/v1/account/accounts/{account-id}/balance'
interface AccountAPI {
    AccountWebSocket: string

    OpenOrders: string

    PlaceOrder: string

    BatchPlaceOrder: string

    BatchCancelOrder: string

    OrderHistory: string

    Orders: string

    Accounts: string

    AccountHistory: string
}

export const V1: AccountAPI = {
    AccountWebSocket: 'wss://api.huobi.pro/ws/v1',

    OpenOrders: '/v1/order/openOrders',

    PlaceOrder: '/v1/order/orders/place',

    BatchPlaceOrder: '/v1/order/batch-orders',

    BatchCancelOrder: '/v1/order/orders/batchcancel',

    OrderHistory: '/v1/order/history',

    Orders: '/v1/order/orders',

    Accounts: '/v1/account/accounts',

    AccountHistory: '/v1/account/history'
}


export const MarketAPI = 'https://api.huobi.pro'
export const MarketDetailMerged = '/market/detail/merged'
export const MarketSymbols = '/v1/common/symbols'

export const BaseCurrency = [
    'btc',
    'usdt',
    'husd',
    'eth',
    'ht',
    'eos'
]