import fg from 'fast-glob';
import Mocha from 'mocha';

async function runTests() {
  const mocha = new Mocha({
    reporter: 'spec',
    timeout: 5000,
  });

  const testFiles = await fg('tests/unit/**/*.test.ts', {
    cwd: process.cwd(),
    absolute: true,
  });

  for (const file of testFiles) {
    mocha.addFile(file);
  }

  mocha.run(failures => {
    process.exit(failures ? 1 : 0);
  });
}

runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
