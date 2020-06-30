declare module 'log4js-extend' {
    import { Log4js } from 'log4js'
    export interface Option {
        path: string
        format: string
    }

    export default function (log4js: Log4js, options: Option): Log4js
}