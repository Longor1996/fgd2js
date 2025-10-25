import { randomUUID } from 'crypto';
import type {LookAhead } from './lookahead.ts';
import {lookahead } from './lookahead.js';

export type TokenType = "symbol"
	| "paren" | "bracket" | "brace"
	| "switch"
	| "ident" | "string" | "number"
;

export interface Token {
	type: TokenType,
	span: [number, number]
}

export function *tokenizer(input: string): IterableIterator<Token, null> {
	const WHITESPACE = /\s/
	const NAME_START = /[a-z_]/i
	const NAME_PART = /[a-z/\-\d\._]/i
	const NUMBER = /[\.\d]/
	const SYMBOL = /[@,.:=+*&>~<!&|^]/
	
	let idx = 0;
	let span_start = 0;
	let span_end = 0;
	
	const token = (type:TokenType): Token => {
		return {type, span: [span_start, span_end = idx]};
	};
	
	while(idx < input.length) {
		let char = input[idx];
		let char_next = input[idx+1];
		if(char === undefined) break;
		while(WHITESPACE.test(char)) {
			char = input[++idx];
			char_next = input[1+idx];
		}
		if(char === '/' && input[idx+1] === '/') {
			while(input[++idx] != '\n' && char !== undefined) {
				char = input[idx];
				char_next = input[1+idx];
			}
			continue
		}
		
		if(char === undefined) break;
		span_start = idx;
		
		if(SYMBOL.test(char)) {
			idx++;
			yield token("symbol");
		}
		else if(char === '(' || char === ')') {
			idx++;
			yield token("paren");
		}
		else if(char === '[' || char === ']') {
			idx++;
			yield token("bracket");
		}
		else if(char === '{' && char_next === '{') {
			idx++;
			idx++;
			yield token("switch");
		}
		else if(char === '}' && char_next === '}') {
			idx++;
			idx++;
			yield token("switch");
		}
		else if(char === '{' || char === '}') {
			idx++;
			yield token("brace");
		}
		else if(char === '"') {
			span_start++;
			while(true) {
				char = input[++idx];
				if(char === '"' && input[idx-1] !== '\\') break;
			}
			yield token("string");
			idx++;
		}
		else if(char === "'") {
			span_start++;
			while(true) {
				char = input[++idx];
				if(char === "'" && input[idx-1] !== '\\') break;
			}
			yield token("string");
			idx++;
		}
		else if(NAME_START.test(char)) {
			while(NAME_PART.test(input[++idx]) && input[idx] !== undefined);
			yield token("ident");
		}
		else if((char >= '0' && char <= '9') || (char == '-' && NUMBER.test(char_next))) {
			while(NUMBER.test(input[++idx]));
			if(NAME_START.test(input[idx])) {
				while(NAME_PART.test(input[++idx]) && input[idx] !== undefined);
				yield token("ident");
				continue;
			}
			yield token("number");
		}
		else if(char == '-') {
			idx++;
			yield token("symbol");
		}
		else {
			throw `Unexpected character \`${char}\` at ${idx}.`;
		}
	}
	
	return null;
}

export class TokenStream {
	#name: string;
	#input: string;
	#tokens: LookAhead<Token, null, null>;
	#token: Token|null = null;
	constructor(name: string, input: string) {
		this.#name = name;
		this.#input = input;
		this.#tokens = lookahead(tokenizer(input));
	}
	
	get name() {
		return this.#name;
	}
	
	get span_start() {
		return this.#token?.span[0] ?? 0;
	}
	get span_end() {
		return this.#token?.span[1] ?? 0;
	}
	
	more() {
		return !this.#tokens.done();
	}
	pushback(item: Token) {
		this.#tokens.back(item);
	}
	
	current() {
		return this.#token;
	}
	current_str() {
		if(!this.#token) throw `No current token.`;
		return this.span(this.#token);
	}
	
	next() {
		const token = this.#tokens.next();
		if(!token.done) this.#token = token.value;
		return token;
	}
	next_or_throw() {
		const token = this.#tokens.next();
		if(token.done) throw `Expected token, but reached EOF.`;
		return this.#token = token.value;
	}
	
	ahead(ahead: number = 1, type?:TokenType, value?:string): Token|undefined {
		const token = this.#tokens.ahead(ahead);
		if(!token) return undefined;
		if(type !== undefined && token.type !== type) return undefined;
		if(value !== undefined && this.span(token) != value) return undefined;
		return token;
	}
	behind(behind: number = 1) {
		const token = this.#tokens.behind(behind);
		if(!token) throw `Expected token behind, but reached EOF.`;
		return token;
	}
	
	span(token: Token): string {
		return this.#input.slice(token.span[0],token.span[1]);
	}
	
	expect(type:TokenType, value?:string): Token {
		const ahead = this.#tokens.ahead(1);
		if(!ahead) throw `Expected ${type}-token, but reached EOF.`;
		if(ahead.type !== type) throw `Expected ${type}-token, but got ${ahead.type}, at ${ahead.span[0]}.`;
		if(value !== undefined && this.span(ahead) != value) throw `Expected ${type}-token containing "${value}", but got ${ahead.type} containing "${this.span(ahead)}", at ${ahead.span[0]}.`;
		return this.next_or_throw();
	}
	expect_str(type:TokenType, value?:string): string {
		return this.span(this.expect(type,value));
	}
	match(type:TokenType, value?:string): boolean {
		const ahead = this.#tokens.ahead(1);
		if(!ahead) return false;
		if(ahead.type !== type) return false;
		if(value !== undefined && this.span(ahead) != value) return false;
		this.next_or_throw();
		return true;
	}
	match_one(type:TokenType, value: Array<string>): number {
		const ahead = this.#tokens.ahead(1);
		if(!ahead) return -1;
		if(ahead.type !== type) return -1;
		const item = value.indexOf(this.span(ahead));
		if(item == -1) return -1;
		this.next_or_throw();
		return item;
	}
	match_not(type:TokenType, value?:string, eof: boolean = false): boolean {
		const ahead = this.#tokens.ahead(1);
		if(!ahead) return eof;
		if(ahead.type === type) return false;
		if(value !== undefined && this.span(ahead) == value) return false;
		this.next_or_throw();
		return true;
	}
	literal(init?: string): string {
		if(!init && init !== '') {
			init = this.expect_str('string');
		}
		while(this.match('symbol', '+')) {
			if(this.match('string')) {
				init += "\n" + this.current_str();
			}
		}
		return init;
	}
}

export interface FGDNodeBase {span: [number, number], type: string}
export interface FGDVersion extends FGDNodeBase {type: "Version", version:number}
export interface FGDInclude extends FGDNodeBase {type: "Include", name:string}
export interface FGDExclude extends FGDNodeBase {type: "Exclude", name:string}
export interface FGDMapSize extends FGDNodeBase {type: "MapSize", x:string, y:string}
export interface FGDEntityGroup extends FGDNodeBase {type: "EntityGroup", name:string, meta?: Record<string,any>}
export interface FGDVisGroupFilter extends FGDNodeBase {type: "VisGroupFilter", args: Record<string, any>}
export interface FGDAutoVisGroup extends FGDNodeBase {type: "AutoVisGroup", name:string, groups:Record<string, Array<string>>}
export interface FGDMaterialExclusion extends FGDNodeBase {type: "MaterialExclusion", list: Array<string>}
export interface FGDParserMetadata extends FGDNodeBase {type: "__PARSER_METADATA__", meta: any}
export interface FGDClassDecl extends FGDNodeBase {
	type: "Class",
	kind: string,
	name: string,
	desc?: string,
	impl: FGDClassBaseDecl[]
	meta?: FGDClassMetaDecl[]
	body: FGDPropDecl[]
}
export interface FGDPropDecl {
	span: [number, number],
	kind: "input"|"output"|"prop"
	star?: boolean,
	name: string,
	class: string,
	title: string,
	description: string,
	group?: string
	report?: boolean,
	readonly?: boolean,
	important?: boolean,
	metaprops?: Record<string, any>,
	default: any,
	choices?: any[],
}
export type FGDClassBaseDecl = {name: string, args: string | Array<any> | Record<string, any>};
export type FGDClassMetaDecl = {name: string, value: any};
export type FGDPropMetaDecl = {name: string, value: any};
export type FGDNode = FGDNodeBase & (FGDVersion
	| FGDInclude
	| FGDExclude
	| FGDMapSize
	| FGDEntityGroup
	| FGDVisGroupFilter
	| FGDAutoVisGroup
	| FGDMaterialExclusion
	| FGDClassDecl
	| FGDParserMetadata
);
export type FGDTBExpr = {
	span: [number, number],
	expr: string,
	op: string,
	lhs?: string|FGDTBExpr|Array<string|FGDTBExpr>,
	rhs: string|FGDTBExpr|Array<string|FGDTBExpr>
};

export function parse_class_decl(tokens: TokenStream, node_kind: string): FGDClassDecl {
	const node: FGDClassDecl = {
		span: [tokens.current()?.span[0] || 0, -1],
		type: 'Class',
		kind: node_kind,
		name: randomUUID().toString(),
		desc: undefined,
		impl: [],
		body: []
	};
	
	while(tokens.match('ident')) {
		if(!node.meta) node.meta = [];
		let basename = tokens.current_str();
		
		if(tokens.match('brace', '{')) {
			let meta: FGDClassBaseDecl = {
				name: basename, args: parse_record(tokens)
			};
			node.impl.push(meta);
		} else if(tokens.match('paren', '(')) {
			if(tokens.name === 'dday' && (tokens.current()?.span[0]||0) >= 4408) {
				//debugger;
			}
			
			let args: Array<any> = [];
			let base: FGDClassBaseDecl = {name: basename, args};
			node.impl.push(base);
			while( ! tokens.match('paren', ')')) {
				var arg = parse_expression(tokens, 0);
				args.push(arg);
				if(tokens.match('symbol', ',')) {}
			}
			if(args.length === 1 && typeof (args as any[])[0] === 'string') {
				base.args = (args as any[])[0];
			}
		} else {
			let base: FGDClassBaseDecl = {name: basename, args: []};
			node.impl.push(base);
		}
	}
	
	if(tokens.match('symbol', '=')) {
		node.name = tokens.expect_str('ident');
	}
	
	if(tokens.match('symbol', ':') && tokens.match('string')) {
		node.desc = tokens.literal(tokens.current_str());
	}
	
	if(tokens.match('symbol',';')) {
		return node;
	}
	
	while(tokens.match('bracket', '[')) {
		parse_class_body(tokens, node);
	}
	
	return node;
}

export function parse_class_body(tokens: TokenStream, node: FGDClassDecl) {
	while( ! tokens.match('bracket', ']')) {
		let span_start = tokens.ahead()?.span[0] || 0;
		let is_input = tokens.match('ident', 'input');
		let is_output = !is_input && tokens.match('ident', 'output');
		
		let decl: FGDPropDecl = {
			span: [span_start, span_start],
			kind: (is_input ? 'input' : is_output ? 'output' : 'prop'),
			name: tokens.expect_str('ident'),
			class: 'void',
			title: '',
			default: null,
			description: ''
		}; node.body.push(decl);
		//console.log("Parsing decl: ", decl);
		
		if(decl.kind === 'prop' && (/^On[a-zA-Z].*$/).test(decl.name)) {
			decl.kind = 'output';
		}
		
		if(tokens.match('paren', '(')) {
			parse_prop_class(tokens, decl);
		}
		
		if(tokens.match('bracket', '[')) {
			let metaprops: Record<string, any> = {};
			let metacount = 0;
			while( ! tokens.match('bracket', ']')) {
				let pnot = tokens.match('symbol', '!');
				let pkey = tokens.expect_str('ident');
				if(pnot) pkey = '!'+pkey;
				let pval = undefined;
				if(tokens.match('symbol', '=')) {
					pval = tokens.expect_str('string');
				} else {
					pval = true;
				}
				if(pkey === 'report') {
					decl.report = (pval as any) || true;
				} else if(pkey === 'readonly') {
					decl.readonly = (pval as any) || true;
				} else if(pkey === 'important') {
					decl.important = (pval as any) || true;
				} else if(pkey === 'group' && pval) {
					decl.group = pval.toString();
				} else {
					metaprops[pkey] = pval;
					metacount++;
				}
				if(tokens.match('symbol', ',')) {} // TODO: Might be wrong
			}
			if(metacount) {
				decl.metaprops = metaprops;
			}
		}
		
		if(decl.class === 'void' && tokens.match('paren', '(')) {
			parse_prop_class(tokens, decl);
		}
		
		if(tokens.match('brace', '{')) {
			let record: Record<string, any> = parse_record(tokens);
			if(!decl.metaprops)
				decl.metaprops = record;
			else {
				decl.metaprops = Object.assign(decl.metaprops, record);
			}
		}
		
		if(tokens.ahead(2, 'string') && tokens.match('symbol', ':')) {
			decl.title = tokens.literal();
		}
		
		if(tokens.match('symbol', ':') && !tokens.ahead(1, 'symbol', ':')) {
			decl.default = parse_expression(tokens);
		}
		
		if(tokens.match('symbol', ':')) {
			decl.description = tokens.literal();
		}
		
		if(decl.title && decl.description === ''
			&& (
				(decl.title.length >= 80)
				|| (decl.title.length > 48)
				|| (decl.title.length > 32 && decl.title.endsWith('.'))
				|| ((decl.title.match(/\b\w/g) || [])?.length >= 3 && decl.title.endsWith('.'))
				|| ((decl.title.match(/\b\w/g) || [])?.length >= 5 && decl.title.length > 8)
			)) {
			decl.description = decl.title;
			decl.title = '';
		} else if(decl.title && decl.title.endsWith('.')) {
			decl.title = decl.title.slice(0, -1);
		}
		
		if(tokens.match('symbol', '=')) {
			if(decl.class === 'integer' || decl.class === 'flags' || decl.class === 'choices' || decl.class === 'tag_list') {
				tokens.expect('bracket', '[');
				decl.choices = [];
				while( ! tokens.match('bracket', ']')) {
					let cident = tokens.span(tokens.next_or_throw());
					tokens.expect('symbol', ':');
					let cname = tokens.span(tokens.next_or_throw());
					let choice = {
						id: cident,
						name: cname,
					} as any;
					let cdflt = null;
					if(tokens.match('symbol', ':')) {
						cdflt = tokens.span(tokens.next_or_throw());
						if(decl.class === 'flags') {
							if(cdflt === '0')cdflt = false;
							if(cdflt === '1')cdflt = true;
						}
						choice.default = cdflt;
						
						if(tokens.match('symbol', ':')) {
							let cdesc = tokens.span(tokens.next_or_throw());
							choice.description = cdesc;
						}
					}
					decl.choices.push(choice);
				}
			} else {
				debugger;
			}
		}
		
		decl.span[1] = tokens.current()?.span[1] || decl.span[0];
		//console.log("Finished decl: ", decl);
	}
}

export function parse_prop_class(tokens: TokenStream, decl: FGDPropDecl) {
	if(tokens.match('symbol', '*')) decl.star = true;
	decl.class = tokens.expect_str('ident').toLowerCase();
	while(tokens.match('symbol', ':')) {
		decl.class += ':' + tokens.expect_str('ident');
	}
	tokens.expect('paren', ')');
	
	if(tokens.match('ident', 'readonly')) {
		if(!decl.metaprops) decl.metaprops = {};
		decl.metaprops[tokens.current_str()] = true;
	}
	if(tokens.match('ident', 'report')) {
		if(!decl.metaprops) decl.metaprops = {};
		decl.metaprops[tokens.current_str()] = true;
	}
}

export function parse_record(tokens: TokenStream, json: boolean = false) {
	const sep = json ? ':' : '=';
	let record: Record<string, any> = {};
	
	while( ! tokens.match('brace', '}')) {
		let pkey = tokens.expect_str(json ? 'string' : 'ident');
		let pval = undefined;
		if(tokens.match('symbol', sep)) {
			if(tokens.match('brace', '{')) {
				pval = parse_record(tokens);
			} else if(tokens.match('bracket', '[')) {
				pval = parse_array(tokens);
			} else {
				pval = tokens.span(tokens.next_or_throw());
			}
		} else {
			pval = true;
		}
		record[pkey] = pval;
		if(tokens.match('symbol', ',')) {}
	}
	return record;
}

export const expression_precedence: {[op: string]: number} = {
	'*': 12,
	'/': 12,
	'%': 12,
	'+': 11,
	'-': 11,
	'<<': 10,
	'>>': 10,
	'<': 9,
	'<=': 9,
	'>': 9,
	'>=': 9,
	'==': 8,
	'!=': 8,
	'&': 7,
	'^': 6,
	'|': 5,
	'&&': 4,
	'||': 3,
	'..': 2,
	'->': 1,
} as const;

export function parse_operator(tokens: TokenStream, initial?: string) {
	if(!initial) {
		if(tokens.match('symbol')) {
			initial = tokens.current_str();
		} else {
			throw `Expected symbol`;
		}
	}
	switch(initial) {
		case '-': return tokens.match('symbol', '>') ? '->' : initial;
		case '<': return tokens.match('symbol', '<') ? '<<' : (
			tokens.match('symbol', '=') ? '<=' : initial
		);
		case '>': return tokens.match('symbol', '>') ? '>>' : (
			tokens.match('symbol', '=') ? '>=' : initial
		);
		case '=': return tokens.match('symbol', '=') ? '==' : initial;
		case '!': return tokens.match('symbol', '=') ? '!=' : initial;
		case '&': return tokens.match('symbol', '&') ? '&&' : initial;
		case '|': return tokens.match('symbol', '|') ? '||' : initial;
		default: return initial;
	}
}

export function parse_expression(tokens: TokenStream, min_bp: number = 0): string|FGDTBExpr|null {
	let lhs_maybe = parse_expression_unary(tokens);
	if(lhs_maybe === null) return null;
	let lhs = lhs_maybe;
	
	while(tokens.more()) {
		if(tokens.match('symbol')) {
			let span = tokens.current()?.span || [0,0];
			let op = parse_operator(tokens, tokens.current_str());
			let bp = expression_precedence[op];
			if(bp === undefined || bp < min_bp) {
				tokens.pushback({
					type: 'symbol',
					span: [span[0], tokens.current()?.span[1] || span[1]]
				});
				break;
			}
			
			let rhs = parse_expression(tokens, bp) || [];
			lhs = {
				span: [span[0], tokens.current()?.span[1] || span[1]],
				expr: 'infix',
				op: op,
				lhs: lhs,
				rhs: rhs
			};
		}
		else if(tokens.match('bracket', '[')) {
			let span = tokens.current()?.span || [0,0];
			const rhs = parse_expression(tokens) || [];
			tokens.expect('bracket', ']');
			lhs = {
				span: [span[0], tokens.current()?.span[1] || span[1]],
				expr: 'postfix',
				op: '[]',
				lhs: lhs,
				rhs: rhs
			};
		} else break;
	}
	
	return lhs;
}

export function parse_expression_unary(tokens: TokenStream): string|FGDTBExpr|null {
	if(tokens.match('switch', '{{')) {
		let span = tokens.current()?.span || [0,0];
		let cases: Array<string|FGDTBExpr> = [];
		let deflt = undefined;
		while(!tokens.match('switch', '}}')) {
			let lhs = parse_expression(tokens);
			tokens.match('symbol', ',');
			if(lhs===null) continue;
			if(typeof lhs === 'string' && !deflt) {
				deflt = lhs;
			} else {
				cases.push(lhs);
			}
		}
		return {
			span: [span[0], tokens.current()?.span[1] || span[1]],
			expr: 'unary',
			op: '{{}}',
			lhs: deflt,
			rhs: cases
		};
	}
	if(tokens.match('brace', '{')) {
		let span = tokens.current()?.span || [0,0];
		let map: Array<FGDTBExpr> = [];
		while(!tokens.match('brace', '}')) {
			let span = tokens.current()?.span || [0,0];
			let lhs = parse_expression(tokens);
			if(lhs===null) continue;
			tokens.expect('symbol', ':');
			let rhs = parse_expression(tokens) || [];
			tokens.match('symbol', ',');
			map.push({
				span: [span[0], tokens.current()?.span[1] || span[1]],
				expr: 'infix',
				op: ':',
				lhs,
				rhs
			});
		}
		return {
			span: [span[0], tokens.current()?.span[1] || span[1]],
			expr: 'unary',
			op: '{}',
			rhs: map
		};
	}
	if(tokens.match('paren', '(')) {
		let span = tokens.current()?.span || [0,0];
		var rhs = parse_expression(tokens) || [];
		tokens.expect('paren', ')');
		return {
			span: [span[0], tokens.current()?.span[1] || span[1]],
			expr: 'unary',
			op: '()',
			rhs
		};
	}
	if(tokens.match('bracket', '[')) {
		let span = tokens.current()?.span || [0,0];
		var rhs = parse_expression(tokens) || [];
		tokens.expect('bracket', ']');
		return {
			span: [span[0], tokens.current()?.span[1] || span[1]],
			expr: 'unary',
			op: '[]',
			rhs
		};
	}
	if(tokens.match_one('symbol', ['+', '-', '!', '~']) != -1) {
		let span = tokens.current()?.span || [0,0];
		const op = tokens.current_str();
		return {
			span: [span[0], tokens.current()?.span[1] || span[1]],
			expr: 'unary',
			op: op,
			rhs: parse_expression(tokens, expression_precedence[op]) || []
		};
	}
	return parse_expression_terminal(tokens);
}

export function parse_expression_terminal(tokens: TokenStream): string|null {
	if(tokens.match('string')) {
		return tokens.current_str();
	}
	else if(tokens.match('ident')) {
		return tokens.current_str();
	}
	else if(tokens.match('number')) {
		return tokens.current_str();
	}
	else return null;
}

export function parse_array(tokens: TokenStream) {
	let array: Array<any> = [];
	while( ! tokens.match('bracket', ']')) {
		let pval = undefined;
		if(tokens.match('brace', '{')) {
			pval = parse_record(tokens);
		} else if(tokens.match('bracket', '[')) {
			pval = parse_array(tokens);
		} else {
			pval = tokens.span(tokens.next_or_throw());
		}
		array.push(pval);
		if(tokens.match('symbol', ',')) {} // TODO: Might be wrong
	}
	return array;
}

export function* parse(name: string, input: string): IterableIterator<FGDNode> {
	var tokens = new TokenStream(name, input);
	var classes: Record<string, Array<string>> = {};
	var class_tags: Array<string> = [];
	var property_classes: Array<string> = [];
	var property_groups: Array<string> = [];
	let span_start = 0;
	
	loop:while(tokens.more()) {
		
		if(tokens.match('symbol', '@')) {
			span_start = tokens.current()?.span[0] || 0;
			let node_type = tokens.expect_str('ident');
			let node_type_i = node_type.toLowerCase();
			
			if(node_type_i.endsWith('class')
				|| node_type_i.endsWith('event')
				|| node_type_i.endsWith('data')
				|| node_type_i === 'struct'
			) {
				// `node_type` becomes `node_kind` here!
				let class_decl = parse_class_decl(tokens, node_type);
				
				if(!classes[node_type]) classes[node_type] = [];
				if(!classes[node_type].includes(class_decl.name))
					classes[node_type].push(class_decl.name);
				
				class_decl.span[1] = tokens.current()?.span[1] || span_start;
				class_decl.impl.forEach(({name, args}) => {
					if(name === 'tags') {
						if(typeof args === 'string') {
							if(name === 'tags' && !class_tags.includes(args as string)) {
								class_tags.push(args as string);
							}
						} else if(Array.isArray(args)) {
							args.forEach(tag => {
								if(name === 'tags' && !class_tags.includes(tag)) {
									class_tags.push(tag);
								}
							})
						} else {
							debugger
						}
					}
				});
				class_decl.body.forEach((decl) => {
					if(!property_classes.includes(decl.class)) {
						property_classes.push(decl.class);
					}
					if(decl.group && !property_groups.includes(decl.group)) {
						property_groups.push(decl.group);
					}
				});
				
				yield class_decl;
				continue loop;
			}
			
			switch (node_type_i) {
				case 'version': {
					tokens.expect('paren', '(');
					let v = tokens.expect_str('number');
					tokens.expect('paren', ')');
					yield {
						span: [span_start,tokens.current()?.span[1] || span_start],
						type: 'Version', version: Number(v)
					};
				} continue loop;
				case 'include': {
					let name = tokens.expect_str('string');
					yield {
						span: [span_start,tokens.current()?.span[1] || span_start],
						type:'Include', name
					};
				} continue loop;
				case 'exclude': {
					let name = tokens.expect_str('ident');
					yield {
						span: [span_start,tokens.current()?.span[1] || span_start],
						type:'Exclude', name
					};
				} continue loop;
				case 'mapsize': {
					tokens.expect('paren', '(');
					let x = tokens.expect_str('number');
					tokens.expect('symbol', ',');
					let y = tokens.expect_str('number');
					tokens.expect('paren', ')');
					yield {
						span: [span_start,tokens.current()?.span[1] || span_start],
						type: 'MapSize', x, y
					};
				} continue loop;
				case 'materialexclusion': {
					var list: Array<string> = [];
					tokens.expect('bracket', '[');
					while(tokens.match('string')) {
						list.push(tokens.current_str());
					}
					tokens.expect('bracket', ']');
					yield {
						span: [span_start,tokens.current()?.span[1] || span_start],
						type: 'MaterialExclusion', list
					};
				} continue loop;
				case 'autovisgroup': {
					var groups: Record<string, Array<string>> = {};
					tokens.expect('symbol', '=');
					var name = tokens.expect_str('string');
					tokens.expect('bracket', '[');
					while(!tokens.match('bracket', ']')) {
						var group_name = tokens.expect_str('string');
						var group_list: Array<string> = [];
						tokens.expect('bracket', '[');
						while(!tokens.match('bracket', ']')) {
							var group_item = tokens.expect_str('string');
							group_list.push(group_item);
							tokens.match('symbol', ',');
						}
						groups[group_name] = group_list;
					}
					yield {
						span: [span_start,tokens.current()?.span[1] || span_start],
						type: 'AutoVisGroup', name, groups
					};
				} continue loop;
				case 'entitygroup': {
					let name = tokens.expect_str('string');
					let meta = undefined;
					if(tokens.match('brace', '{')) {
						meta = parse_record(tokens);
					}
					yield {
						span: [span_start,tokens.current()?.span[1] || span_start],
						type:'EntityGroup', name, meta
					};
				} continue loop;
				case 'visgroupfilter': {
					tokens.expect('brace', '{');
					let args: Record<string, any> = {};
					while( ! tokens.match('brace', '}')) {
						let key = tokens.expect_str('ident');
						tokens.expect('symbol', '=');
						let val = tokens.expect_str('string');
						args[key] = val;
					}
					yield {
						span: [span_start,tokens.current()?.span[1] || span_start],
						type: 'VisGroupFilter',
						args: args
					};
				} continue loop;
				default: throw `Unexpected FGDNode ${node_type} at ${span_start}.`;
			}
		}
		
		//console.log(`${token.span[0]}..${token.span[1]} \t${token.type}\t${tokens.span(token)}`);
		const token = tokens.next().value;
		if(!token) break;
		throw `Unexpected ${token.type} at ${token.span[0]}..${token.span[1]}: ${tokens.span(token)}`;
	}
	
	var span_end = tokens.current()?.span[1] || span_start;
	yield {
		span: [0,span_end],
		type: "__PARSER_METADATA__",
		meta: {
			classes: Object.values(classes).map(a => a.sort()),
			class_tags: class_tags.sort(),
			property_classes: property_classes.sort()
		}
	};
}

export default {};
