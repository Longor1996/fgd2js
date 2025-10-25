# FGD to JSON

> **Disclaimer:** This was written just for fun in a single weekend; do not expect any code quality here!

---

This tiny Typescript program/library parses [FGD files](https://developer.valvesoftware.com/wiki/FGD) into an *Abstract Syntax Tree*, which is then output as JSON, looking kinda like this:

```json
[{
	"name": "quake"
}
, {
	"span": "213:505",
	"type": "Class",
	"kind": "SolidClass",
	"name": "worldspawn",
	"desc": "World entity",
	"impl": [],
	"body": [
		{
			"span": "259:304",
			"kind": "prop",
			"name": "message",
			"class": "string",
			"title": "",
			"default": null,
			"description": "Text on entering the world"
		},
		...
	]
},
...
]
```

> **Note:** The spans are global character positions, *not* `LINE:COLUMN` pairs!

The [Trenchbroom](https://trenchbroom.github.io/) [expression language](https://trenchbroom.github.io/manual/latest/#expression_language) is also supported, resulting in JSON like this:

```json
{
	"name": "studio",
	"args": [
		{
			"span": "11471:11709",
			"expr": "unary",
			"op": "{{}}",
			"lhs": "models/items/grenades/paint/ground.md2",
			"rhs": [
				{
					"span": "11491:11556",
					"expr": "infix",
					"op": "->",
					"lhs": {
						"span": "11480:11493",
						"expr": "infix",
						"op": "==",
						"lhs": "type",
						"rhs": "paint"
					},
					"rhs": {
						"span": "11495:11555",
						"expr": "unary",
						"op": "{}",
						"rhs": [
...
```

---

The following FGD files were tested:

```
# From https://developer.valvesoftware.com/wiki/Category:FGD
alienswarm.fgd
alyx.fgd
base.fgd
blackmesa.fgd
cs2.fgd
garrysmod.fgd
halflife2.fgd
hammerplusplus.fgd
hlvr.fgd
infra.fgd
left4dead2.fgd
models_gamedata.fgd
portal2.fgd
quake.fgd
quake2.fgd
quake2arghrad.fgd
source2003.fgd
source2007.fgd
source2009.fgd
source2013mp.fgd
workshop_addoninfo_base.fgd

# From Trenchbroom default game configs
wrath.fgd
dday.fgd
Episode 1.fgd
Episode 2.fgd
Episode 3.fgd
Episode 4.fgd
heretic2.fgd
Hexen2.fgd
kingpin.fgd
neverball.fgd
pball2.fgd
Quetoo.fgd
Quoth2.fgd
Teamfortress.fgd

# From https://github.com/Pinsplash/SEFGD
SECSGO.fgd
SECSGO_legacy.fgd
SECSS.fgd
SECSS_legacy.fgd
SEHL_base.fgd
SEHL_DM.fgd
SEHL_EP2.fgd
SEHL_HL2.fgd
SEHL_legacy.fgd
SEL4D2.fgd
SEL4D2_legacy.fgd
SEP2.fgd
SEP2_legacy.fgd

# From https://github.com/Erty-Gamedev/GoldSrcFGDCollection
## WARN: Some of these FGD's have typos in them!
bshift.fgd
cs-cz.fgd
cs-cz-ds.fgd
CSCZDS_1.1.5.fgd
counter-strike.fgd
dod.fgd
dmc.fgd
firearms.fgd
half-life.fgd
op4.fgd
ricochet.fgd
spirit_v1.4.fgd
spirit.fgd
spirit_v1.2.fgd
sven-coop4.8.fgd
sven-coop-new_dsc.fgd
tfc.fgd
ts_fgd.fgd
ts_1.5.fgd
ts_2.1.fgd
thdm.fgd
zhlt.fgd
```
