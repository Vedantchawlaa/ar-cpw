const { toWords } = require('number-to-words');
const fs = require('fs');

const logFile = 'tmp/to-words-log.txt';
fs.writeFileSync(logFile, '');

function test(val) {
    let output = '';
    try {
        output = `Input: ${val} (${typeof val}) -> Result: "${toWords(val)}"\n`;
    } catch (e) {
        output = `Input: ${val} (${typeof val}) -> FAILED: ${e.message}\n`;
    }
    fs.appendFileSync(logFile, output);
    console.log(output.trim());
}

test(123);
test(123.45);
test(0);
test(-10);
test(NaN);
test(Infinity);
test(undefined);
test(null);
