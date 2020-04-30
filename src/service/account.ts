import {map, mergeMap, reduce, tap, filter} from 'rxjs/operators';
import {from, Subject, Observable} from 'rxjs';
import {getLogger} from 'log4js';
import {Auth} from './auth'
import { qGet, Method, Direction } from '../utils/rest';
import { V1, AccountAPI } from '../utils/const';
import { PlainObj, MsgType } from '../data/obj';
import { Op } from '../data/spot';
import { SpotAccount } from '../websocket/spot_pool';
import { BasePool } from '../websocket/base_pool';

export enum AccountType {
    Spot = 'spot',
    Margin = 'margin',
    Otc = 'otc'
}

export enum SubAccountType {
    Trade = 'trade',
    Loan = 'loan',
    Interest = 'interest'
}

export enum AccountState {
    Working = 'working',
    Lock = 'lock',
}

export interface AccountInfo {
    id: number,
    type: AccountType,
    subtype: string,
    state: AccountState 
}

export enum BalanceType {
    Trade = 'trade',
    Forzen = 'forzen'
}

export interface BalanceInfo {
    currency: string
    type: BalanceType
    balance: string
}

export interface AccountBalances {
    id: number
    type: AccountType
    state: AccountState
    list: Array<BalanceInfo>
}

export class Account {
    auth: Auth
    accountsInfo: Map<AccountType, AccountInfo> | null

    constructor (authService: Auth){
        this.auth = authService
        this.accountsInfo = null
    }

    getAccountByType (type: AccountType): Promise<AccountInfo>{
        if(this.accountsInfo != null){
            getLogger().debug(`use cache account:${this.accountsInfo}`)
            return Promise.resolve(<AccountInfo> this.accountsInfo.get(type)) 
        }

        return from(qGet<Array<AccountInfo>>(AccountAPI + V1.Accounts, this.auth.addSignature(AccountAPI + V1.Accounts, Method.GET, {})))
            .pipe(
                mergeMap(datas => from(<Array<AccountInfo>>datas)),
                reduce((acc, value)=>{
                    acc.set(value.type, value)
                    return acc
                }, new Map()),
                tap(data => {this.accountsInfo = data}),
                map(data => data.get(type))
            ).toPromise()
    }

    getBalance (account: AccountInfo): Promise<AccountBalances> {
        const url = `${AccountAPI + V1.Accounts}/${account.id}/balance`
        return qGet(url, this.auth.addSignature(url, Method.GET, {}))
    }

    getHistories(params: AccountHistoryInput): Promise<Array<AccountHistoryItem>> {
        const url = `${AccountAPI + V1.AccountHistory}`
        return qGet(url, this.auth.addSignature(url, Method.GET, params))
    }

    //ws
    subAccountUpdate(pool: BasePool, includeFrozen: boolean): Observable<Array<BalanceChangeItem>> {
        let topic = 'accounts'
        let res = new Subject<Array<BalanceChangeItem>>()

        pool.messageQueue.pipe(
            filter(msg => msg.msgType === MsgType.Msg && msg.data !== undefined),
            map(msg => JSON.parse(<string>msg.data)),
            filter(msg => msg.topic === topic)
        )
        .subscribe(data => {
            if(data.errCode){
                res.error(data)
            }else{
                if(data.data){
                    res.next(data.data)
                }
            }
        })

       pool.send({
           op: Op.Sub,
           topic,
           model: includeFrozen? 1: 0
       })

       return res
    }
}

export interface BalanceChangeItem {
    ['account-id']: number
    currency: string
    type: SubAccountType
    balance: string
}

export interface AccountHistoryInput {
    ['account-id']: string
    currency?: string
    ['transact-types']?: string
    ['start-time']?: number //unix
    ['end-time']?: number
    size?: number //default 100
    sort?: string //asc or desc 
}

export interface AccountHistoryItem {
    accountId: number
    currency: string 
    transactAmt: string
    transactType: string
    recordId: number
    availBalance: string,
    acctBalance: string,
    transactTime: number 
}