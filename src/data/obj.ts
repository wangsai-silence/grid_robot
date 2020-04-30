export enum MsgType{
    Open = 'open', 
    Close = 'close', 
    Error = 'error',
    Msg = 'message',
    Check = 'check',
}

export interface Msg {
    msgType: MsgType
    errCode?: string
    data?: string
}

export interface PlainObj {
    [key: string]: any
}