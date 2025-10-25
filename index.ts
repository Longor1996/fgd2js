import {readFileSync, createWriteStream, mkdirSync, existsSync} from 'fs';
import {glob} from 'fs/promises';
import {parse} from './fgd.js';

function process(file: string) {
	let name = file.slice(0, -4);
	if(name.startsWith('fgd')) name = name.slice(4);
	let json = `out/${name}.json`;
	let fout = createWriteStream(json);
	console.log(`Processing file "${file}" -> "${json}"`);
	fout.write(`[${JSON.stringify({name}, null, '\t')}\n`);
	for (const node of parse(name, readFileSync(file, 'utf-8'))) {
		fout.write(`, ${JSON.stringify(node, ((k,v) => k === 'span' ? `${v[0]}:${v[1]}`: v), '\t')}\n`);
	}
	fout.write("]\n");
	fout.close();
}

if(!existsSync('out')) mkdirSync('out');
for await (const fgd of glob('fgd/*.fgd')) {
	try {
		process(fgd);
	} catch (error) {
		console.error(error);
	}
}
