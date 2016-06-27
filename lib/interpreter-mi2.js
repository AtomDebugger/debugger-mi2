'use babel'

/* @flow */

import { Emitter } from 'atom'

export default class InterpreterMi2 {
  emitter: Emitter;

  constructor() {
    this.emitter = new Emitter()
  }

  interpret(data: string) {

    for (let line of data.split('\n')) {

      const resultBegin = line.indexOf(',')
      const result = (resultBegin > 0) ? this.convertResult(line.slice(resultBegin+1)) : undefined

      if (/^\*running/.test(line)) {
        this.emitter.emit('is-running', result)
      } else if (/^\*stopped/.test(line)) {
        this.emitter.emit('stopped-execution', result)
      } else if (/^\^error/.test(line)) {
        const message = (result) ? result.msg : 'Unknown error occured'
        atom.notifications.addError(message, { dismissable: true })
      } else if (/^\^exit/.test(line)) {
        this.emitter.emit('did-end-session')
      }
    }
  }

  convertValue(value: string): mixed {

    const stripped = value.slice(1,-1)

    if (value.charAt(0) == '"') {

      return stripped
    } else if (value.charAt(0) == '{') {

      return this.convertResult(stripped)
    } else if (value.charAt(0) == '[') {

      const isNamed = (value.indexOf('=') < value.search(/[{("]/))

      if (isNamed) {
        return this.convertResult(stripped)
      } else {
        let result = []

        let indexStart = 0
        let scopeDepth = 0

        for (let i=0; i<stripped.length; i++) {
          if (stripped.charAt(i) == '{') {
            scopeDepth++
          } else if (stripped.charAt(i) == '}') {
            scopeDepth--
          } else if (stripped.charAt(i) == ',' && scopeDepth == 0) {
            const attribute  = stripped.substring(indexStart, i)

            result.push(this.convertValue(attribute))
            indexStart = i+1
          }
        }

        const attribute  = stripped.substring(indexStart)
        result.push(this.convertValue(attribute))

        return result
      }
    }
  }

  convertResult(value: string): Object {
    let result = new Object;

    let indexStart = 0
    let scopeDepth = 0

    for (let i=0; i<value.length; i++) {
      if (value.charAt(i) == '{') {
        scopeDepth++
      } else if (value.charAt(i) == '}') {
        scopeDepth--
      } else if (value.charAt(i) == ',' && scopeDepth == 0) {
        const attribute  = value.substring(indexStart, i)
        const name       = attribute.slice(0, attribute.indexOf('='))
        const val        = attribute.slice(attribute.indexOf('=')+1)

        result[name] = this.convertValue(val)
        indexStart = i+1
      }
    }

    const attribute  = value.substring(indexStart)
    const name       = attribute.slice(0, attribute.indexOf('='))
    const val        = attribute.slice(attribute.indexOf('=')+1)

    result[name] = this.convertValue(val)

    return result
  }
}
