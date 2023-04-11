const fs = require('fs')

const cut = ((x, t = 1) => x.substring(0, x.length - t))
const trim = ((x) => {
    while (x.startsWith(' ') || x.startsWith('\t') || x.startsWith('\n')) x = x.substring(1)
    while (x.endsWith(' ') || x.endsWith('\t') || x.endsWith('\n')) x = cut(x)

    return x
})

const id = ((length = 10) => {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const charactersLength = characters.length
    let counter = 0
    while (counter++ < length) result += characters.charAt(Math.floor(Math.random() * charactersLength))
    return `key-${result}`
})

const parse = ((text, expression = false) => {
    const reader = ((input) => {
        let txt = input
        let pointer = 0

        // checks if the string has any chatracters left to read
        const valid = ((x = 0) => {
            return pointer + x + 1 < text.length
        })
        // gets the current character and moves the pointer
        const get = (() => valid(-1) ? txt[pointer++] : null)
        // gets the current character without moving the pointer
        const peek = (() => valid(-1) ? txt[pointer] : null)
        // gets the previous character for escape sequences.
        const last = (() => pointer !== 0 ? txt[pointer - 1] : null)
        // gets the string trailing from the current pointer.
        const file = (() => txt.substring(pointer))

        // read a specified number of characters and move the pointer
        const read = ((x) => new Array(x).fill('').map(e => get()).join(''))
        // read the string until the `e` character is found.
        // if `s` is provided, it will add to the depth and prevent issues. alr understood
        const readUntil = ((e, s = null, s2 = null, k = 0) => {
            let x = ''
            let d = (s2 ? 0 : -1) + k

            let string = false

            while (((peek() !== e || d > 0) || string) && valid()) {
                if (peek() === '\'' && last() !== '\\') string = !string
                if ((!s2 ? (peek() === e) : (peek() === s2)) && d > 0 && !string) {
                    // console.log('removed on ' + peek())
                    d--
                }
                if (!!s && peek() === s && !string) {
                    // console.log('added on ' + peek())
                    d++
                }
                x += get()
                if(x.includes('undefine')) return ''
            }

            let g = trim(x + get())
            // console.log(g)
            return g
        })

        // throws an error.
        const error = ((e) => { throw 'magic parser error: ' + e })

        // reverts the pointer back for a read string or x characters.
        const revert = ((x) => typeof x === 'string' ? !!(pointer -= x.length) : (typeof x === 'number' ? !!(pointer -= x) : error('cannot revert without an integer or string type')))

        const startsWith = ((x) => file().trim().startsWith(x))
        const endsWith = ((x) => file().trim().endsWith(x))

        return {
            raw: pointer,
            pointer: () => pointer,
            valid,
            get,
            peek,
            last,
            file,
            read,
            readUntil,
            error,
            revert,
            startsWith,
            endsWith
        }
    })

    const express = ((txt) => {
        let t = reader(txt)
        // check for null
        if (txt === 'nul') return null
        // check for booleans
        else if (txt.replaceAll(')', '').replaceAll('(', '') === 'true') return true
        else if (txt.replaceAll(')', '').replaceAll('(', '') === 'false') return false
        // check for numbers
        else if (txt.match(/^[\d.]+\){0,1}$/g)) return parseFloat(txt.replaceAll(')', ''))
        // check for strings
        else if (txt.startsWith('\'')) return cut(txt, 1).substring(1)
        else {
            let node = {
                type: 'command',
                command: cut(t.readUntil('(')),
                expression: parse(cut(t.readUntil(')', '(')), true)
            }

            if (!node.expression && !node.command || (node.expression === '' || node.command === '')) {
                if (txt !== '') {
                    return {
                        type: 'access',
                        name: txt
                    }
                } else {
                    return []
                }
            }

            return node
        }
    })

    if (expression) {
        if (text === 'nul' || text === '') return []

        const r = reader(text)
        let bunch = []
        while (r.valid()) {
            let x = r.readUntil(',', '(', ')')
            bunch.push(x === 'nul' ? 'nul' : (x.endsWith(',') ? cut(x) : x))
        }

        let x = r.readUntil('')
        if (x !== 'null') bunch.push(x === 'nul' ? 'nul' : x)

        for (let i in bunch) bunch[i] = express(bunch[i])

        return bunch[0] === null ? null : bunch
    } else {
        const t = reader(text)
        let ast = []

        while (t.valid()) {
            // when parsing, there are a number of possibilites:

            // 1. an expression
            // an incoming expression such as `2`, `'hello :)'` or `add(2)` should be parsed into javascript objects for the AST.

            // 2. a command
            // commands will be read until a semicolon is met, then parsed into a command-arguments format.

            // 3. a statement
            // statements will be read until the root pair of {} closes, then parsed into a Array<command> format. afterwards, each command will be parsed individually.
            
            // existing statements:
            const statements = ['while', 'for', 'if', 'else', 'function']

            let checks = statements.filter(e => t.startsWith(e))
            if (checks.length === 1) {
                // the current checkpoint is a statement.
                let f = reader(t.readUntil('}', '{'))
                let node = {
                    type: 'statement',
                    id: id(),
                    statement: f.readUntil(' '),
                    expression: parse(cut(f.readUntil('{')), true),
                    content: f.readUntil('}', '{', '', 1)
                }

                let x = cut(t.readUntil('{'), 2)
                if(node.statement === 'if' && x === 'else') {
                    t.revert(1)
                    node.else = parse(cut(t.readUntil('}', '{')).substring(1))
                }

                node.content = parse(node.content, false).filter(e => !e?.command?.match(/^(undefined{0,1})+$/g))

                ast.push(node)
            } else {
                // it is a command.
                let f = reader(t.readUntil(';'))
                if (f.startsWith('let ')) {
                    // cut the `let` from the name
                    f.readUntil(' ')
                    let node = {
                        type: 'variable',
                        name: cut(f.readUntil('='), 1).trim(),
                        expression: parse(cut(f.readUntil(';')), true)
                    }

                    ast.push(node)
                } else {
                    let node = {
                        type: 'command',
                        command: cut(f.readUntil('(')),
                        expression: parse(cut(f.readUntil(')', '(')), true)
                    }

                    if(node.command === 'import') {
                        let name = node.expression[0]

                        if (name.startsWith('./')) ast.push(...parse(fs.readFileSync(name, 'utf-8')))
                        else {
                            // i will write shitty package manager code here
                            // but not now
                            // maybe later
                        }
                    } else ast.push(node)
                }
            }
        }

        const prune = ((tree) => tree.filter(e =>
            e.command === '' ? false :
                (e.expression === 'nul' ? false : true))
            .map(e => {
                for (let f of Object.keys(e)) {
                    if (e[f]) if (typeof e[f] === 'object' && !!e[f].indexOf) e[f] = prune(e[f])
                }

                return e
            }))

            /* console.table([
                t.pointer(),
                text.substring(0, t.pointer()),
                text.substring(t.pointer())
            ]) */

        try {
            return prune(ast)
        } catch (e) {
            return ast
        }
    }
})

module.exports = parse