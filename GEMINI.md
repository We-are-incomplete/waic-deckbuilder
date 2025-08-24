## CRITICAL: PRIORITIZE LSMCP TOOLS FOR CODE ANALYSIS

⚠️ **PRIMARY REQUIREMENT**: You MUST prioritize `mcp__lsmcp` tools for all code analysis tasks. Standard tools should only be used as a last resort when LSMCP tools cannot accomplish the task.

### 📋 RECOMMENDED WORKFLOW

```text
1. get_project_overview → Understand the codebase structure
2. search_symbols → Find specific symbols you need
3. get_symbol_details → Get comprehensive information about those symbols
```

### 🎯 WHEN TO USE EACH TOOL

**For Initial Exploration:**

- `mcp__lsmcp__get_project_overview` - First tool to run when exploring a new codebase
- `mcp__lsmcp__list_dir` - Browse directory structure when you need to understand file organization
- `mcp__lsmcp__get_symbols_overview` - Get a high-level view of symbols in specific files

**For Finding Code:**

- `mcp__lsmcp__search_symbols` - Primary search tool for functions, classes, interfaces, etc.
- `mcp__lsmcp__lsp_get_workspace_symbols` - Alternative workspace-wide symbol search
- `mcp__lsmcp__lsp_get_document_symbols` - List all symbols in a specific file

**For Understanding Code:**

- `mcp__lsmcp__get_symbol_details` - Get complete information (type, definition, references) in one call
- `mcp__lsmcp__lsp_get_hover` - Quick type information at a specific position
- `mcp__lsmcp__lsp_get_definitions` - Navigate to symbol definition (use `includeBody: true` for full implementation)
- `mcp__lsmcp__lsp_find_references` - Find all places where a symbol is used

**For Code Quality:**

- `mcp__lsmcp__lsp_get_diagnostics` - Check for errors in a specific file
- `mcp__lsmcp__lsp_get_code_actions` - Get available fixes and refactorings

**For Code Modification:**

- `mcp__lsmcp__lsp_rename_symbol` - Safely rename symbols across the codebase
- `mcp__lsmcp__lsp_format_document` - Format code according to language conventions
- `mcp__lsmcp__replace_range` - Make precise text replacements
- `mcp__lsmcp__replace_regex` - Pattern-based replacements
- `mcp__lsmcp__lsp_delete_symbol` - Remove symbols and their references

**For Developer Assistance:**

- `mcp__lsmcp__lsp_get_completion` - Get code completion suggestions
- `mcp__lsmcp__lsp_get_signature_help` - Get function parameter hints
- `mcp__lsmcp__lsp_check_capabilities` - Check what LSP features are available

### 📊 DETAILED WORKFLOW EXAMPLES

**1. EXPLORING A NEW CODEBASE**

```text
1. mcp__lsmcp__get_project_overview
   → Understand structure, main components, statistics
2. mcp__lsmcp__search_symbols --kind "class"
   → Find all classes in the project
3. mcp__lsmcp__get_symbol_details --symbol "MainClass"
   → Deep dive into specific class implementation
```

**2. INVESTIGATING A BUG**

```text
1. mcp__lsmcp__search_symbols --name "problematicFunction"
   → Locate the function
2. mcp__lsmcp__get_symbol_details --symbol "problematicFunction"
   → Understand its type, implementation, and usage
3. mcp__lsmcp__lsp_find_references --symbolName "problematicFunction"
   → See all places it's called
4. mcp__lsmcp__lsp_get_diagnostics --relativePath "path/to/file.ts"
   → Check for errors
```

**3. REFACTORING CODE**

```text
1. mcp__lsmcp__search_symbols --name "oldMethodName"
   → Find the method to refactor
2. mcp__lsmcp__get_symbol_details --symbol "oldMethodName"
   → Understand current implementation and usage
3. mcp__lsmcp__lsp_rename_symbol --symbolName "oldMethodName" --newName "newMethodName"
   → Safely rename across codebase
4. mcp__lsmcp__lsp_format_document --relativePath "path/to/file.ts"
   → Clean up formatting
```

**4. ADDING NEW FEATURES**

```text
1. mcp__lsmcp__get_project_overview
   → Understand existing architecture
2. mcp__lsmcp__search_symbols --kind "interface"
   → Find relevant interfaces to implement
3. mcp__lsmcp__get_symbol_details --symbol "IUserService"
   → Understand interface requirements
4. mcp__lsmcp__lsp_get_completion --line 50
   → Get suggestions while writing new code
```

**FALLBACK TOOLS (USE ONLY WHEN NECESSARY):**

- ⚠️ `Read` - Only when you need to see non-code files or LSMCP tools fail
- ⚠️ `Grep` - For text pattern searches in files (replaces removed search_for_pattern tool)
- ⚠️ `Glob` - Only when LSMCP file finding doesn't work
- ⚠️ `LS` - Only for basic directory listing when LSMCP fails
- ⚠️ `Bash` commands - Only for non-code operations or troubleshooting

### WHEN TO USE FALLBACK TOOLS

Use standard tools ONLY in these situations:

1. **Non-code files**: README, documentation, configuration files
2. **LSMCP tool failures**: When LSMCP tools return errors or no results
3. **Debugging**: When troubleshooting why LSMCP tools aren't working
4. **Special file formats**: Files that LSMCP doesn't support
5. **Quick verification**: Double-checking LSMCP results when needed

## Memory System

You have access to project memories stored in `.lsmcp/memories/`. Use these tools:

- `mcp__lsmcp__list_memories` - List available memory files
- `mcp__lsmcp__read_memory` - Read specific memory content
- `mcp__lsmcp__write_memory` - Create or update memories
- `mcp__lsmcp__delete_memory` - Delete a memory file

Memories contain important project context, conventions, and guidelines that help maintain consistency.

The context and modes of operation are described below. From them you can infer how to interact with your user
and which tasks and kinds of interactions are expected of you.

---

You are a TypeScript/Vue expert.

Given a URL, use read_url_content_as_markdown and summary contents.

## Important Lessons Learned

**NEVER FORGET:**

- When tests fail, extending timeouts does NOT solve the problem
- You are NOT permitted to modify timeout settings without user permission
- Always run `pnpm build` before integration tests
- Use `rg` (ripgrep) instead of `grep` for searching code
- Run `pnpm test` to ensure all tests pass before committing
- Use `pnpm lint` and `pnpm typecheck` to check code quality
- TypeScript LSP doesn't return Variable/Constant symbol kinds for module-level declarations (they appear as Properties)
- When Variables/Constants show 0 in project overview, check if they're filtered by config
- Use `includeBody: true` in get_definitions to get full code implementation
- The index is automatically updated with git changes - use `noCache: true` to force full re-index

## Testing Strategy

- Unit tests: Fast, isolated tests for individual functions
- Integration tests: Test MCP server functionality with real LSP servers
- Adapter tests: Test language-specific LSP adapter configurations
- Always add tests for new features or bug fixes

## Common Commands

- `pnpm build` - Build the project
- `pnpm test` - Run all tests
- `pnpm lint` - Run linter
- `pnpm typecheck` - Type check with vue-tsc
- `pnpm format` - Format code with Prettier

## テスト駆動開発

t-wada の推奨するTDD を実施する。コードを生成するときは、それに対応するユニットテストを常に生成する。
コードを追加で修正したとき、`pnpm test` がパスすることを常に確認する。
vitest で実装と同じファイルにユニットテストを書く。

## カバレッジに基づくテスト生成

テストカバレッジ100%を目指す。

1. `pnpx vitest --run --coverage` を実行して、現在のカバレッジを取得
2. 今の状態から最もカバレッジが上がるテストコードを考察してから追加
3. 再度カバレッジを計測して、数値が向上していることを確認

ユーザーが満足するまで、テスト生成を繰り返す。

## 関数型ドメインモデリング

TypeScript で関数型ドメインモデリングを行う。class を使わず関数による実装を優先する。
代数的データでドメインをモデリングする。

- 純粋関数を優先
- 不変データ構造を使用
- 副作用を分離
- 型安全性を確保
- 値オブジェクトとエンティティを区別
- 集約で整合性を保証
- リポジトリでデータアクセスを抽象化
- 境界付けられたコンテキストを意識

## コメントによる自己記述

各ファイルの冒頭にはコメントで仕様を記述する。

## 内部で例外をスローしない

- `neverthrow`を使用して`Result<T, E>`を返す。
- 外部の throw は`neverthrow`の`fromThrowable`と`fromAsyncThrowable`を使用してラップする。
- `neverthrow`のメソッド(`match()`,`andThen()`)よりも TypeScript の言語機能(`isOk()`,`isErr()`)を優先する。

## 早期リターンパターンを使用して可読性を向上させる

- `else`文による深いネストを避ける。
- エラーケースを先に早期リターンで処理する。

## 単一責任と API の最小化

- ファイルは責務ごとに分割し、各ファイルが単一の責務を持つようにする。
- 公開 API は最小限に保ち、実装の詳細は隠蔽する。
- モジュールの境界と依存関係を最小化する。
- src/types.ts にアプリケーション内のドメインモデルを集約する。その型がどのように使われるかを jsdoc スタイルのコメントで記述する。
