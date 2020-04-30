import * as rp from 'request-promise'

import {getLogger} from 'log4js';

import {changeToCamelCase} from './string'
import { PlainObj } from '../data/obj';

export interface HttpResp<T> {
    status: string,
    errMsg?: string,
    errCode?: string,
    data?: T
    tick?: T
}

export enum Method {
    GET = 'GET',
    POST = 'POST'
}

export enum Direction {
    Prev = 'prev',
    Next = 'next'
}

export function qGet<T> (host: string, params: PlainObj, timeout: number = 5000): Promise<T> {
    getLogger().debug(host, params)

    return rp.get({
        method: Method.GET,
        uri: host,
        qs: params, 
        timeout: timeout,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36'
        },
    })
    .then(res => changeToCamelCase(res))
    .then(res => {
        let data: HttpResp<T> = JSON.parse(res)
        if(data.data){
            return Promise.resolve(data.data)
        } 

        if(data.tick) {
            return Promise.resolve(data.tick)
        }

        return Promise.reject(data)
    })    
    .error(reason => Promise.reject({
        status: 'error',
        errMsg: reason,
        errCode: 'error'
    }))
}

export function qPost<T> (host: string, params: PlainObj, queryParams: PlainObj, timeout: number=5000): Promise<T> {
    getLogger().debug(host, params)

    return rp.post({
        uri: host,
        method: Method.POST,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36',
	    'Content-Type': 'application/json'
        },
        qs: queryParams,
        timeout: timeout,
        body: JSON.stringify(params)
    })
    .then(res => changeToCamelCase(res))
    .then(res => {
        let data: HttpResp<T> = JSON.parse(res)
        if(data.data){
            return Promise.resolve(data.data)
        } 

        return Promise.reject(data)
    })
    .error(reason => {
        getLogger().warn(reason)

        return Promise.reject({
        status: 'error',
        errMsg: reason,
        errCode: 'error'
    })})
}
