import { interval, throwError, of, from } from "rxjs";
import { mergeMap, retry } from "rxjs/operators";


describe('retry', () => {

    let errCreate = async (val: number) => {
        if (val > 3)
            throw new Error('Fuckkkkkkkkkkkkkkkkkkkkkkkkk')

        return val
    }

    interval(1000).pipe(
        mergeMap(val => from(errCreate(val))),
        retry(1)
    ).subscribe({
        next: val => console.log(val),
        error: val => console.log(`${val}: Retried 2 times then quit!`)
    });
})