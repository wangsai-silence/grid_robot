export function changeToCamelCase(input: string): string {
    return input
            .replace(/field-/g, 'filled-')
            .replace(/-.{1}.*:/g, (match, p1, p2) => innerReplace(match))
}

function innerReplace(input: string): string {
    if(input.match(/\d*E-\d*/)){
        return input
    }

	return input.replace(/-.{1}/g, (m, p1, p2) => m.substring(1).toUpperCase())
}
