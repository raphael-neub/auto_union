export class Builder {
  private _buffer: string;
  private _done: boolean;
  private _indent: string;
  private _debug: boolean;

  constructor(headerComment?: string, indent?: string, debug?: boolean) {
    this._buffer = "";
    if (headerComment !== undefined) {
      const lines = headerComment.split(/\r\n|\r|\n/);
      for (let line of lines) {
        if (line.trim().length !== 0) {
          this._buffer += "// ";
          this._buffer += line;
          this._buffer += "\n";
        }
      }
    }
    this._debug = debug ? true : false;
    this._indent = indent ? indent : "    ";
    this._done = false;
  }

  public build(...args: buildargs[]) {
    if (this._done) throw new Error("Cannot build script twice!");
    if (this._debug) console.log(args);
    if (args.length < 1) {
      return;
    }
    if (args.length < 2) {
      this.build1arg(args[0]);
      this._done = true;
      return;
    }
    this.buildMultiArg(args);
    this._done = true;
  }

  public getString(): string {
    return (" " + this._buffer).slice(1);
  }

  private build1arg(arg: buildargs) {
    const typeSet = new Set<string>();
    const unionSet = new Map<string, Set<string>>();
    if (arg.filename.endsWith(".ts")) {
      arg.filename = arg.filename.slice(0, -3);
    }
    arg.filename = arg.filename.replaceAll('\\', '/');
    let importname = arg.importname;
    if (!importname) {
      importname = this.getVarNameFromFile(arg.filename);
    }
    arg.interfaces.forEach((item) => typeSet.add(item));
    arg.types.forEach((item) => typeSet.add(item));
    arg.unionEnums.forEach((item) => {
      const curset = new Set<string>(...item.values);
      const prevset = unionSet.get(item.name)
      if(prevset !== undefined){
        prevset.forEach((i) => curset.add(i));
      }
      unionSet.set(item.name, curset);
    });
    this._buffer += "import * as " + importname;
    this._buffer += ' from "' + arg.filename + '";\n\n';
    for (let type of typeSet) {
      this._buffer += "export type " + type + " = ";
      this._buffer += importname + "." + type + ";\n";
    }
    this._buffer += "export {\n";
    for (const e of arg.enums) {
      this._buffer += this._indent + e + ",\n";
    }
    this._buffer += '} from "' + arg.filename + '";\n';
    // union enums
    for(let u of unionSet.keys()) {
      const values = unionSet.get(u);
      if(values === undefined) continue;
      this._buffer += "export type " + u + " = ";
      this._buffer += importname + "." + u + ";\n";
      // create constant
      this._buffer += "export const " + u + " = {\n"
      for (let val of values) {
        let name = val.toLocaleLowerCase();
        if(name.match(/^[a-z]/g)) {
          name = name.charAt(0).toLocaleUpperCase() + name.substring(1);
        } else {
          name = "_" + name;
        }
        this._buffer += this._indent + name + ': "' + val + '",\n';
      }
      this._buffer += "} as const;\n"
    }
  }

  private buildMultiArg(args: buildargs[]) {
    const typeSet = new Set<string>();
    const enumSet = new Set<string>();
    const unionSet = new Map<string, Set<string>>();
    for (let arg of args) {
      if (arg.filename.endsWith(".ts")) {
        arg.filename = arg.filename.slice(0, -3);
      }
      arg.filename = arg.filename.replaceAll('\\', '/');
      if (arg.importname === undefined || arg.importname.trim().length === 0) {
        arg.importname = this.getVarNameFromFile(arg.filename);
      }
      if (arg.enumWrapper === undefined || arg.enumWrapper.trim().length === 0) {
        arg.enumWrapper = arg.importname;
      }
      arg.interfaces.forEach((item) => typeSet.add(item));
      arg.types.forEach((item) => typeSet.add(item));
      arg.enums.forEach((item) => enumSet.add(item));
      arg.unionEnums.forEach((item) => {
        const curset = new Set<string>(item.values);
        const prevset = unionSet.get(item.name)
        if(prevset !== undefined){
          prevset.forEach((i) => curset.add(i));
        }
        unionSet.set(item.name, curset);
      });
      this._buffer += "import * as " + arg.importname;
      this._buffer += ' from "' + arg.filename + '";\n';
    }
    this._buffer += "\n";
    // types and interfaces
    for (let type of typeSet) {
      this._buffer += "export type " + type + " = ";
      let startunion = false;
      for (let arg of args) {
        if (arg.interfaces.includes(type) || arg.types.includes(type)) {
          if (startunion) {
            this._buffer += " | ";
          }
          this._buffer += arg.importname + "." + type;
          startunion = true;
        }
      }
      this._buffer += ";\n";
    }
    // enums
    for (let e of enumSet) {
      // create type
      this._buffer += "export type " + e + " = ";
      let startunion = false;
      for (let arg of args) {
        if (arg.enums.includes(e)) {
          if (startunion) {
            this._buffer += " | ";
          }
          this._buffer += arg.importname + "." + e;
          startunion = true;
        }
      }
      this._buffer += ";\n";
      // create constant
      this._buffer += "export const " + e + " = {\n"
      for (let arg of args) {
        if (arg.enums.includes(e)) {
          this._buffer += this._indent + arg.enumWrapper + ": { ..." + arg.importname + "." + e + "},\n";
        }
      }
      this._buffer += "};\n"
    }
    // union enums
    for(let u of unionSet.keys()) {
      const values = unionSet.get(u);
      if(values === undefined) continue;
      this._buffer += "export type " + u + " = ";
      let startunion = false;
      for (let arg of args) {
        if (arg.unionEnums.some((e) => e.name === u)) {
          if (startunion) {
            this._buffer += " | ";
          }
          this._buffer += arg.importname + "." + u;
          startunion = true;
        }
      }
      this._buffer += ";\n";
      // create constant
      this._buffer += "export const " + u + " = {\n"
      for (let val of values.values()) {
        console.log(val);
        let name = val.toLocaleLowerCase();
        if(name.match(/^[a-z]/g)) {
          name = name.charAt(0).toLocaleUpperCase() + name.substring(1);
        } else {
          name = "_" + name;
        }
        this._buffer += this._indent + name + ': "' + val + '",\n';
      }
      this._buffer += "} as const;\n"
    }
  }

  private getVarNameFromFile(filename: string): string {
    const lastSlash = filename.lastIndexOf("/");
    const lastBackSlash = filename.lastIndexOf("/");
    let varname = filename;
    if (lastSlash > 0) {
      varname = filename.slice(lastSlash + 1);
    }
    if (lastBackSlash > lastSlash) {
      varname = filename.slice(lastBackSlash + 1);
    }
    varname = varname.replace(/[^a-z0-9]/gi, "_").replace(/_{2,}/g, "_");
    return varname;
  }
}

export type buildargs = {
  filename: string;
  importname?: string;
  enumWrapper?: string;
  interfaces: string[];
  types: string[];
  enums: string[];
  unionEnums: enumMap[];
}

export type enumMap = {
  name: string;
  values: string[];
}
