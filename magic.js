const parser = require('./parser')
const fs = require('fs')

// returns syntax tree
const magic = ((text) => {
    const reduce = ((operation) => eval(`((...args) => args.reduce((a, b) => a ${operation} b))`))
    const build = ((operation) => eval(`((arg1, arg2) => arg1 ${operation} arg2)`))
    const argbuilder = ((x, txt) => eval(`((${new Array(x).fill('').map((e, i) => `arg${i}`).join(', ')}) => ${txt.replaceAll('ARGS', new Array(x).fill('').map((e, i) => `arg${i}`).join(', '))})`))
    const builtin = ({
        comment: (() => {}),

        add: reduce('+'),
        subtract: reduce('-'),
        multiply: reduce('*'),
        divide: reduce('/'),
        exponent: reduce('**'),
        remainder: reduce('%'),
        '+': reduce('+'),
        '-': reduce('-'),
        '*': reduce('*'),
        '/': reduce('/'),
        '**': reduce('**'),
        '%': reduce('%'),

        'not': ((arg1) => !arg1),
        'and': reduce('&&'),
        'or': reduce('||'),
        'xor': reduce('^'),
        'equals': reduce('=='),
        'more': build('>'),
        'less': build('<'),
        '!': ((arg1) => !arg1),
        '&': reduce('&&'),
        '|': reduce('||'),
        '^': reduce('^'),
        '=': reduce('=='),
        '>': build('>'),
        '<': build('<'),
        '>=': build('>='),
        '<=': build('<='),

        log: argbuilder(20, `console.log([ARGS].filter(e => !!e).join(''))`)
    })

    const ast = parser(text)
    let variables = {}

    const find = ((path) => {
        try {
            let x = ast
            for (let p of path) x = (x[p] ?? undefined)

            return x
        } catch {
            return [path?.command ?? 'nul']
        }
    })

    const run = ((path = [], call = false, vars = {}) => {
        let tree = call === true ? path : find(path)
        if (tree === undefined) return
        if (tree === 'nul') return null
        if (typeof tree !== 'object') return tree

        const parse = ((cmd) => typeof cmd !== 'object' ? cmd : (!!cmd?.map ? cmd.map(e => parse(e)) : run(cmd, true, vars)))

        if (!!tree?.map && tree.length !== 1) return tree.map((e) => run(e, true, vars))
        else if (tree.length === 1) return tree[0]
        else {
            let token = !!tree?.map ? tree[0] : tree
            if (token.type === 'statement' && token.statement !== 'function') {
                if (token.statement === 'if') {
                    if (run(token.expression, true, vars)) run(token.content, true, vars)
                    else if (token.else) run(token.else, true, vars)
                } else if (token.statement === 'while') {
                    while (run(token.expression[0], true, vars)) run(token.content, true, vars)
                } else if (token.statement === 'for') {
                    for(let i = token.expression[0]; i <= token.expression[1]; i++) {
                        run(token.content, true, {...vars, i})
                    }
                }
            } else if (token.type === 'command') {
                if (builtin[token.command]) {
                    let x = builtin[token.command](...run(token.expression, true, vars))

                    return x
                }
                else {
                    const search = ((name) => {
                        let cur = path
                        const get = (() => !!find(cur)?.map ? find(cur).filter(e => e?.type === 'variable' && e?.name === name) : [])

                        while (get().length === 0) {
                            if (cur.length === 0) {
                                if (get()[0]) return get()[0]
                                else return undefined
                            }
                            cur = cur.slice(0, cur.length - 1)
                        }

                        return [...cur, find(cur).findIndex(e => e === get()[0])]
                    })

                    const funsearch = ((name) => {
                        let cur = path
                        const get = (() => !!find(cur)?.map ? find(cur).filter(e => e?.type === 'statement' && e?.statement === 'function' && (e?.expression ?? [{ command: undefined }])[0].command === name) : [])

                        while (get().length === 0) {
                            if (cur.length === 0) {
                                if (get()[0]) return get()[0]
                                else return undefined
                            }
                            cur = cur.slice(0, cur.length - 1)
                        }

                        return [...cur, find(cur).findIndex(e => e === get()[0])]
                    })

                    return run(find(funsearch(token.command)).content, true, {...vars})
                }
            } else if (token.type === 'access') return vars[token.name] ?? variables[token.name] ?? undefined
            else if (token.type === 'variable') {
                variables[token.name] = token.expression.length !== 1 ? token.expression : token.expression
            }
        }
    })

    fs.writeFileSync('output.json', JSON.stringify(ast, null, 4))
    run()

    return ast
})

// console.log(magic.parse(fs.readFileSync('test.magic', 'utf8')))
magic(fs.readFileSync('test.magic', 'utf8'))