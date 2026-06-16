import { createRequire } from 'module'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const require = createRequire(import.meta.url)
const mammoth = require('mammoth')

const docPath = resolve(process.cwd(), 'docs', 'SaaS Architecture Prompt System — Complete Edition.docx')
console.log('Reading:', docPath)

const result = await mammoth.extractRawText({ path: docPath })
writeFileSync('./scripts/_doc_extract.txt', result.value, 'utf8')
console.log('Written. Total chars:', result.value.length)
console.log('\n--- FIRST 4000 CHARS ---\n')
console.log(result.value.slice(0, 4000))
