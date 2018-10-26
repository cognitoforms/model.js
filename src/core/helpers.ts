export function ensureNamespace(name, parentNamespace) {
    var result, nsTokens, target = parentNamespace;

    if (target.constructor === String) {
        nsTokens = target.split(".");
        target = window;
        nsTokens.forEach(function (token) {
            target = target[token];

            if (target === undefined) {
                throw new Error("Parent namespace \"" + parentNamespace + "\" could not be found.");
            }
        });
    } else if (target === undefined || target === null) {
        target = window;
    }

    // create the namespace object if it doesn't exist, otherwise return the existing namespace
    if (!(name in target)) {
        result = target[name] = {};
        return result;
    } else {
        return target[name];
    }
}

export function navigateAttribute(obj, attr: string, callback: Function, thisPtr: any = null) {
    for (var val = obj[attr]; val != null; val = val[attr]) {
        if (callback.call(thisPtr || obj, val) === false) {
            return;
        }
    }
}

var funcRegex = /function\s*([\w_\$]*)/i;

export function parseFunctionName(f) {
    var result = funcRegex.exec(f);
    return result ? (result[1] || "{anonymous}") : "{anonymous}";
}

var typeNameExpr = /\s([a-z|A-Z]+)/;

export function getTypeName(obj) {
    if (obj === undefined) return "undefined";
    if (obj === null) return "null";
    return Object.prototype.toString.call(obj).match(typeNameExpr)[1].toLowerCase();
}

export function getDefaultValue(isList: boolean, jstype: any): any {
    if (isList) return [];
    if (jstype === Boolean) return false;
    if (jstype === Number) return 0;
    return null;
}

export function randomInteger(min: number = 0, max: number = 9) {
	var rand = Math.random();
	return rand === 1 ? max : Math.floor(rand * (max - min + 1)) + min;
}

export function randomText(len: number, includeDigits: boolean = false) {
	var result = "";
	for (var i = 0; i < len; i++) {
		var min = 0;
		var max = includeDigits ? 35 : 25;
		var rand = randomInteger(min, max);
		var charCode;
		if (rand <= 25) {
			// Alpha: add 97 for 'a'
			charCode = rand + 97;
		}
		else {
			// Num: start at 0 and add 48 for 0
			charCode = (rand - 26) + 48;
		}
		result += String.fromCharCode(charCode);
	}
	return result;
}
