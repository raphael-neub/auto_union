import "typescript";
import ts from "typescript";
import { readFileSync } from "fs";

export function parse(sourceFile: ts.SourceFile, debug?: boolean): parserReturn {
  const ret: parserReturn = {interfaces: [], types: [], enums: [], unionEnums: []};
  /** True if this is visible outside this file, false otherwise */
  function isNodeExported(node: ts.Node): boolean {
    return (
      (ts.getCombinedModifierFlags(node as ts.Declaration) &
        ts.ModifierFlags.Export) !==
      0 ||
      (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
    );
  }

  function parserNode(node: ts.Node) {
    switch (node.kind) {
      case ts.SyntaxKind.InterfaceDeclaration:
        const inode = node as ts.InterfaceDeclaration;
        let isExportInterface = isNodeExported(node);
        if (debug) console.log(inode.name.text + " " + isExportInterface);
        if (isExportInterface) ret.interfaces.push(inode.name.text);
        break;

      case ts.SyntaxKind.TypeAliasDeclaration:
        const tnode = node as ts.TypeAliasDeclaration;
        let isExportType = isNodeExported(node);
        if (debug) console.log(tnode.name.text + " " + isExportType);
        if (!isExportType) break;

        if (tnode.type.kind === ts.SyntaxKind.UnionType) {
          let isLiteralUnion = true;
          let literals: Set<string> = new Set;
          let unionType = tnode.type as ts.UnionTypeNode
          unionType.types.forEach((t)=>{
            if(t.kind !== ts.SyntaxKind.LiteralType) {
              isLiteralUnion = false;
              return;
            }
            let lt = t as ts.LiteralTypeNode;
            if(lt.literal.kind !== ts.SyntaxKind.StringLiteral) {
              isLiteralUnion = false;
              return;
            }
            let slit = lt.literal as ts.StringLiteral;
            literals.add(slit.text);
          });
          if(isLiteralUnion){
            ret.unionEnums.push({name: tnode.name.text, values: [...literals]})
            break;
          }
        }
        ret.types.push(tnode.name.text);
        break;

      case ts.SyntaxKind.EnumDeclaration:
        const enode = node as ts.EnumDeclaration;
        let isExportEnum = isNodeExported(node);
        if(debug) console.log(enode.name.text + " "+ isExportEnum);
        if(isExportEnum) ret.enums.push(enode.name.text);
        break;

      default:
        break;
    }

    ts.forEachChild(node, parserNode);
  }

  parserNode(sourceFile);
  return ret;
}

export type parserReturn = {
  interfaces: string[];
  types: string[];
  enums: string[];
  unionEnums: enumMap[];
}

export type enumMap = {
  name: string;
  values: string[];
}

export function parseSourceFile(fileName: string, scriptTarget: ts.ScriptTarget) {
  const sourceFile = ts.createSourceFile(
    fileName,
    readFileSync(fileName).toString(),
    scriptTarget
  );
  return parse(sourceFile);
}