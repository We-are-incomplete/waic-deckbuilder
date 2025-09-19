# 関数型ドメインモデリング

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

# コメントによる自己記述

各ファイルの冒頭にはコメントで仕様を記述する。

# 早期リターンパターンを使用して可読性を向上させる

- `else`文による深いネストを避ける。
- エラーケースを先に早期リターンで処理する。

# 単一責任と API の最小化

- ファイルは責務ごとに分割し、各ファイルが単一の責務を持つようにする。
- 公開 API は最小限に保ち、実装の詳細は隠蔽する。
- モジュールの境界と依存関係を最小化する。

# Common Commands

- `pnpm build` - Build the project
- `pnpm lint` - Run linter
- `pnpm typecheck` - Type check with vue-tsc
- `pnpm format` - Format code with Prettier

# Semantic Commit Messages

Format: `<type>(<scope>): <subject>`

`<subject>` is written in Japanese.

Type Examples:

- `feat`: (new feature for the user, not a new feature for build script)
- `fix`: (bug fix for the user, not a fix to a build script)
- `docs`: (changes to the documentation)
- `style`: (formatting, missing semi colons, etc; no production code change)
- `refactor`: (refactoring production code, eg. renaming a variable)
- `test`: (adding missing tests, refactoring tests; no production code change)
- `chore`: (updating grunt tasks etc; no production code change)
