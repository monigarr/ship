import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const startedAt = Date.now();
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const packages = [
  { name: 'web', tsconfig: path.join(repoRoot, 'web', 'tsconfig.json'), srcRoot: path.join(repoRoot, 'web', 'src') },
  { name: 'api', tsconfig: path.join(repoRoot, 'api', 'tsconfig.json'), srcRoot: path.join(repoRoot, 'api', 'src') },
  { name: 'shared', tsconfig: path.join(repoRoot, 'shared', 'tsconfig.json'), srcRoot: path.join(repoRoot, 'shared', 'src') },
];
const evidenceDir = path.join(repoRoot, 'deliverables', '2026-W21-week-01', 'PHASE_2_PRD_BUNDLE', 'evidence');
const outputJson = path.join(evidenceDir, 'c1-measurement.json');
const outputMd = path.join(evidenceDir, 'c1-measurement.md');
const runCommand = 'pnpm audit:c1';
const violationKeys = [
  'anyTypes',
  'asAssertions',
  'nonNullAssertions',
  'tsDirectives',
  'untypedParameters',
  'implicitAnyReturns',
];

function createCounter() {
  return {
    anyTypes: 0,
    asAssertions: 0,
    nonNullAssertions: 0,
    tsDirectives: 0,
    untypedParameters: 0,
    implicitAnyReturns: 0,
  };
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function getPackageForFile(filePath) {
  const normalized = normalizePath(filePath);
  if (normalized.includes('/web/src/')) {
    return 'web';
  }
  if (normalized.includes('/api/src/')) {
    return 'api';
  }
  if (normalized.includes('/shared/src/')) {
    return 'shared';
  }
  return null;
}

function addCounter(target, key, value = 1) {
  target[key] += value;
}

function mergeCounters(target, source) {
  for (const key of violationKeys) {
    target[key] += source[key];
  }
}

function analyzeTsDirectives(sourceText) {
  const commentMatches = sourceText.match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g) ?? [];
  let count = 0;
  for (const comment of commentMatches) {
    const directiveMatches = comment.match(/@ts-ignore|@ts-expect-error/g) ?? [];
    count += directiveMatches.length;
  }
  return count;
}

function containsAny(type, checker, visited = new Set()) {
  if (!type || visited.has(type.id)) {
    return false;
  }
  visited.add(type.id);

  if (type.flags & ts.TypeFlags.Any) {
    return true;
  }

  if (type.isUnionOrIntersection()) {
    return type.types.some((inner) => containsAny(inner, checker, visited));
  }

  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const elementTypes = checker.getTypeArguments(type);
    return elementTypes.some((inner) => containsAny(inner, checker, visited));
  }

  const typeArguments = checker.getTypeArguments(type);
  if (typeArguments.length > 0 && typeArguments.some((inner) => containsAny(inner, checker, visited))) {
    return true;
  }

  return false;
}

function isFunctionLikeNode(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

function hasExplicitReturnType(node) {
  if ('type' in node && node.type) {
    return true;
  }
  return false;
}

function makeProblemReason(fileCounter) {
  const labels = [
    ['anyTypes', 'extensive explicit any usage weakens compile-time guarantees'],
    ['asAssertions', 'heavy type assertion usage suggests runtime shape uncertainty'],
    ['nonNullAssertions', 'frequent non-null assertions can hide unsafe nullability assumptions'],
    ['tsDirectives', 'TS suppression directives bypass static safety checks'],
    ['untypedParameters', 'many untyped parameters reduce call-site and contract clarity'],
    ['implicitAnyReturns', 'missing return annotations with any-like inference reduce API predictability'],
  ];

  const dominant = labels
    .map(([key, message]) => ({ key, message, value: fileCounter[key] }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  if (dominant.length === 0) {
    return 'No issues detected.';
  }
  if (dominant.length === 1) {
    return dominant[0].message;
  }
  return `${dominant[0].message}; secondary driver: ${dominant[1].message}.`;
}

function loadParsedConfig(tsconfigPath, overrides = {}) {
  const readResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (readResult.error) {
    const formatted = ts.formatDiagnosticsWithColorAndContext([readResult.error], {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => process.cwd(),
      getNewLine: () => '\n',
    });
    throw new Error(`Failed to read tsconfig ${tsconfigPath}\n${formatted}`);
  }
  return ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(tsconfigPath),
    overrides,
    tsconfigPath,
  );
}

function countStrictOverrideErrors(pkg) {
  const parsed = loadParsedConfig(pkg.tsconfig, { strict: true, noEmit: true });
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  return diagnostics.length;
}

function analyzePackageProgram(pkg, totals, byPackage, byFile) {
  const parsed = loadParsedConfig(pkg.tsconfig, { noEmit: true });
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });
  const checker = program.getTypeChecker();

  for (const sourceFile of program.getSourceFiles()) {
    const filePath = sourceFile.fileName;
    const isInsideSrc = normalizePath(filePath).startsWith(normalizePath(pkg.srcRoot) + '/');
    if (!isInsideSrc || sourceFile.isDeclarationFile) {
      continue;
    }

    const owningPackage = getPackageForFile(filePath);
    if (!owningPackage) {
      continue;
    }

    if (!byFile[filePath]) {
      byFile[filePath] = createCounter();
    }

    const fileCounter = byFile[filePath];
    const packageCounter = byPackage[owningPackage];

    const tsDirectives = analyzeTsDirectives(sourceFile.getFullText());
    if (tsDirectives > 0) {
      addCounter(fileCounter, 'tsDirectives', tsDirectives);
      addCounter(packageCounter, 'tsDirectives', tsDirectives);
      addCounter(totals, 'tsDirectives', tsDirectives);
    }

    function visit(node) {
      if (ts.isAsExpression(node)) {
        addCounter(fileCounter, 'asAssertions');
        addCounter(packageCounter, 'asAssertions');
        addCounter(totals, 'asAssertions');
      }

      if (ts.isNonNullExpression(node)) {
        addCounter(fileCounter, 'nonNullAssertions');
        addCounter(packageCounter, 'nonNullAssertions');
        addCounter(totals, 'nonNullAssertions');
      }

      if (ts.isTypeNode(node) && node.kind === ts.SyntaxKind.AnyKeyword) {
        addCounter(fileCounter, 'anyTypes');
        addCounter(packageCounter, 'anyTypes');
        addCounter(totals, 'anyTypes');
      }

      if (isFunctionLikeNode(node)) {
        if ('parameters' in node && Array.isArray(node.parameters)) {
          for (const param of node.parameters) {
            if (param.name && ts.isIdentifier(param.name) && param.name.text === 'this') {
              continue;
            }
            if (!param.type) {
              addCounter(fileCounter, 'untypedParameters');
              addCounter(packageCounter, 'untypedParameters');
              addCounter(totals, 'untypedParameters');
            }
          }
        }

        const canHaveReturnTypeCheck =
          !ts.isMethodSignature(node) && !ts.isSetAccessorDeclaration(node) && !ts.isConstructorDeclaration(node);

        if (canHaveReturnTypeCheck && !hasExplicitReturnType(node)) {
          const signature = checker.getSignatureFromDeclaration(node);
          if (signature) {
            const returnType = checker.getReturnTypeOfSignature(signature);
            if (containsAny(returnType, checker)) {
              addCounter(fileCounter, 'implicitAnyReturns');
              addCounter(packageCounter, 'implicitAnyReturns');
              addCounter(totals, 'implicitAnyReturns');
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }
}

function createReport() {
  const totals = createCounter();
  const byPackage = {
    web: createCounter(),
    api: createCounter(),
    shared: createCounter(),
  };
  const byFile = {};

  const strictModePerPackage = {};
  let globalStrictEnabled = true;

  for (const pkg of packages) {
    const parsedConfig = loadParsedConfig(pkg.tsconfig);
    const strictEnabled = parsedConfig.options.strict === true;
    strictModePerPackage[pkg.name] = strictEnabled;
    if (!strictEnabled) {
      globalStrictEnabled = false;
    }
  }

  for (const pkg of packages) {
    analyzePackageProgram(pkg, totals, byPackage, byFile);
  }

  let strictErrorCountIfDisabled = null;
  if (!globalStrictEnabled) {
    strictErrorCountIfDisabled = packages.reduce((sum, pkg) => sum + countStrictOverrideErrors(pkg), 0);
  }

  const topViolationDenseFiles = Object.entries(byFile)
    .map(([filePath, counts]) => {
      const total = violationKeys.reduce((sum, key) => sum + counts[key], 0);
      return {
        file: normalizePath(path.relative(repoRoot, filePath)),
        package: getPackageForFile(filePath),
        total,
        counts,
        whyProblematic: makeProblemReason(counts),
      };
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.file.localeCompare(b.file);
    })
    .slice(0, 5);

  const completedAt = Date.now();
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      repoRoot: normalizePath(repoRoot),
      includedPaths: ['web/src/**/*', 'api/src/**/*', 'shared/src/**/*'],
      typescriptVersion: ts.version,
    },
    strictMode: {
      perPackage: strictModePerPackage,
      strictModeEnabled: globalStrictEnabled,
      strictModeErrorCountIfDisabled: strictErrorCountIfDisabled,
    },
    totals,
    breakdownByPackage: byPackage,
    topViolationDenseFiles,
    repro: {
      command: runCommand,
      exitCode: 0,
      runtimeMs: completedAt - startedAt,
    },
  };

  return report;
}

function renderMarkdown(report) {
  const lines = [
    '# C1 Exact Measurement Report',
    '',
    `Generated: ${report.metadata.generatedAt}`,
    '',
    `Command: \`${report.repro.command}\``,
    '',
    '## Audit Deliverable Table',
    '',
    '| Metric | Your Baseline |',
    '| --- | ---: |',
    `| Total any types | ${report.totals.anyTypes} |`,
    `| Total type assertions (as) | ${report.totals.asAssertions} |`,
    `| Total non-null assertions (!) | ${report.totals.nonNullAssertions} |`,
    `| Total @ts-ignore / @ts-expect-error | ${report.totals.tsDirectives} |`,
    `| Strict mode enabled? | ${report.strictMode.strictModeEnabled ? 'Yes' : 'No'} |`,
    `| Strict mode error count (if disabled) | ${
      report.strictMode.strictModeErrorCountIfDisabled === null
        ? 'N/A'
        : report.strictMode.strictModeErrorCountIfDisabled
    } |`,
    `| Untyped function parameters | ${report.totals.untypedParameters} |`,
    `| Implicit-any-style missing return annotations | ${report.totals.implicitAnyReturns} |`,
    '',
    '## Breakdown By Package And Violation Type',
    '',
    '| Package | any | as | non-null ! | ts directives | untyped params | implicit-any returns |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.breakdownByPackage)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([pkg, counts]) =>
          `| ${pkg} | ${counts.anyTypes} | ${counts.asAssertions} | ${counts.nonNullAssertions} | ${counts.tsDirectives} | ${counts.untypedParameters} | ${counts.implicitAnyReturns} |`,
      ),
    '',
    '## Top 5 Violation-Dense Files',
    '',
    '| File | Package | Total | any | as | non-null ! | ts directives | untyped params | implicit-any returns | Why problematic |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
    ...report.topViolationDenseFiles.map(
      (file) =>
        `| \`${file.file}\` | ${file.package} | ${file.total} | ${file.counts.anyTypes} | ${file.counts.asAssertions} | ${file.counts.nonNullAssertions} | ${file.counts.tsDirectives} | ${file.counts.untypedParameters} | ${file.counts.implicitAnyReturns} | ${file.whyProblematic} |`,
    ),
    '',
    '## Strict Mode Detail',
    '',
    `- web strict: ${report.strictMode.perPackage.web ? 'true' : 'false'}`,
    `- api strict: ${report.strictMode.perPackage.api ? 'true' : 'false'}`,
    `- shared strict: ${report.strictMode.perPackage.shared ? 'true' : 'false'}`,
    '',
  ];
  return lines.join('\n');
}

function main() {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const report = createReport();
  fs.writeFileSync(outputJson, JSON.stringify(report, null, 2));
  fs.writeFileSync(outputMd, renderMarkdown(report));
  console.log(`Wrote ${normalizePath(outputJson)}`);
  console.log(`Wrote ${normalizePath(outputMd)}`);
}

main();
