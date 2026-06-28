# pull_request `closed` イベントで checkout されるコミットの検証

- 日付: 2026-06-28
- 対象ワークフロー: [.github/workflows/cd-test.yaml](../.github/workflows/cd-test.yaml)
- リポジトリ: `ryu-sato/github_action_sandbox`

## 1. 背景・問題

`production` ブランチに対して複数のPRがあるとき、それらを統合するPRを別途作成してマージすると、
**他のPRが一斉に「merged」状態になり、PRの数だけ `cd-test.yaml`（`pull_request: types: [closed]`）が
トリガーされる**。しかも発火順序はコミット順と一致しない。

当初の検討で「自動クローズされた run はどれも同じ production 先端をデプロイするので、
concurrency で1回に集約すれば実害はない」という仮説を立てたが、その根拠が不確かだったため、
**actions/checkout が実際にどのコミットをチェックアウトするか**を実機で検証した。

## 2. 事前調査（actions/checkout ソース）

- [`src/input-helper.ts`](https://github.com/actions/checkout/blob/main/src/input-helper.ts):
  `ref` 未指定時は `github.context.ref` / `github.context.sha` を使う。
  コメントに「**PRがマージされた（pull_request closed）イベントでは ref が `main` のように
  unqualified になる**」と明記され、`refs/heads/<base>` に正規化される。
- [`src/ref-helper.ts`](https://github.com/actions/checkout/blob/main/src/ref-helper.ts):
  `commit`（= `github.sha`）が与えられると、`+<commit>:refs/remotes/origin/<branch>` で
  **その commit を取得してチェックアウト**する。

→ 「base ブランチ名 + `github.sha`」でチェックアウトされる。実際の中身は `github.sha` 次第。
よって `github.sha` の値を実機で確認する必要があった。

## 3. 検証方法

`cd-test.yaml` に、checkout 後の実際の `HEAD` と各 context 値を比較出力するステップを追加。
checkout はデフォルト設定のまま（検証対象の挙動を変えないため）。

stacked な2つのPRを作成して production にマージし、自動クローズを再現:

- PR-A（feature）: `verify-a.txt` を追加
- PR-B（A の上に stack）: `verify-b.txt` を追加（A のコミットを含む）
- PR-B を **merge commit** でマージ → production に A のコミットも入り、**PR-A が自動クローズ**される

2パターン実施:

- **v1**: PR-A/PR-B を「検証ワークフロー導入前の古い production」から分岐
- **v2**: PR-A2/PR-B2 を「検証ワークフロー入りの現在の production」から分岐

## 4. 検証結果

### 4.1 実際にマージされたPR（PR-B, #56）

| 項目 | 値 |
|---|---|
| `github.sha` | `e7bcdf2` |
| `pr.head.sha` | `636e0d5` |
| `pr.merge_commit_sha` | `e7bcdf2` |
| `git rev-parse HEAD` | `e7bcdf2` |
| production 先端 | `e7bcdf2` |

```
HEAD == github.sha          : YES
HEAD == pr.head.sha         : NO    ← PR head は取っていない
HEAD == pr.merge_commit_sha : YES
HEAD == production tip      : YES   ← production 先端をチェックアウト
```

### 4.2 自動クローズされたPR（PR-A, #55 → v2: PR-A2, #58）

v1 では、自動クローズされた PR-A の run は**古いワークフロー**（追加した Verify ステップが無い版）で
動作した。checkout ログ上は次の通り:

```
git fetch ... +5105fbc...:refs/remotes/origin/production   ← github.sha が PR-A の head
ls -al → verify-a.txt はあるが verify-b.txt が無い          ← production 先端ではない
```

v2（PR-A2, #58）で Verify ステップを動作させた結果:

| 項目 | 値 |
|---|---|
| `github.sha` | `c572ce6` |
| `pr.head.sha` | `c572ce6` |
| `pr.merge_commit_sha` | `c572ce6` |
| `git rev-parse HEAD` | `c572ce6` |
| production 先端 | `498685d` |

```
HEAD == github.sha          : YES
HEAD == pr.head.sha         : YES   ← PR 自身の head を取った
HEAD == pr.merge_commit_sha : YES
HEAD == production tip      : NO    ← production 先端ではない
```

### 4.3 まとめ表

| PRの種類 | github.sha / チェックアウト | merge_commit_sha | production先端と一致 | 走るワークフロー |
|---|---|---|---|---|
| **実際にマージ** | `merge_commit_sha`（= production先端） | head と**異なる** | **YES** | そのマージ結果（=最新） |
| **自動クローズ** | **そのPR自身の head** | head と**一致** | **NO** | その古い head のワークフロー |

## 5. 結論

- 当初の仮説「自動クローズされた run はどれも同じ production 先端をデプロイする」は**誤り**。
- **実際にマージされたPR** の closed イベントは `github.sha = merge_commit_sha = production 先端` を
  チェックアウトする（正しい中身）。
- **自動クローズされたPR** の closed イベントは `github.sha = そのPR自身の head`
  （`merge_commit_sha == head.sha` になる）をチェックアウトする。これは
  「古い base + そのPRの変更」という**陳腐化したスナップショット**であり、production 先端ではない。
  さらに**その古いコミットのワークフロー定義**で実行される。

→ 統合PRマージで一斉発火する run 群は、**それぞれ別の陳腐化したコミットを順不同でデプロイ**する。
concurrency による集約は「中身が同じ」前提が崩れるため不適切で、
**自動クローズPRを除外する `if` フィルタが必須**。

## 6. 対応案

自動クローズPRは必ず `merge_commit_sha == head.sha` になる性質を利用し、
**実際にマージされたPR（= production 先端を生成したPR）だけ** CD を走らせる。

```yaml
jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    environment: production
    # 実際にマージされたPRだけで実行。自動クローズされたPRは
    # merge_commit_sha == head.sha になるので除外される。
    if: >-
      github.event.pull_request.merged == true &&
      github.event.pull_request.merge_commit_sha != github.event.pull_request.head.sha
    steps:
    - name: Checkout application repository
      uses: actions/checkout@v6
    - run: |-
        ls -al
        git branch -a
        echo ${{ vars.TEST_A }}
```

効果:

- **回数**: 統合PR（実マージ）1回だけ実行。自動クローズPRは skip。
- **順序**: 実行が1件になり順不同問題が解消。
- **内容**: 実マージPRは production 先端をチェックアウトするため正しい中身をデプロイ。
- **PR checks**: トリガーは `pull_request closed` のままなのでオープンPRのチェックには出ない
  （`push` トリガーに替えない理由）。

### 注意・代替

- fast-forward マージのみ `merge_commit_sha == head.sha` となり誤除外され得る。
  ただし GitHub のマージボタン既定（merge commit / squash / rebase）はいずれも別SHAを生成するため
  実用上問題ない。
- 統合ブランチに命名規則（例 `release/*`）がある運用なら、
  `startsWith(github.event.pull_request.head.ref, 'release/')` との併用がさらに堅実。

## 7. 補足（検証で使った参照値）

- 実マージ PR-B run: `28326976968`（新ワークフロー、Verify あり）
- 自動クローズ PR-A run: `28326978024`（v1、古いワークフロー、Verify なし）
- 自動クローズ PR-A2 run: `28327415587`（v2、新ワークフロー、Verify あり）
- 重要な性質: **自動クローズPRは `pull_request.merge_commit_sha == pull_request.head.sha`**

## 8. 後片付け（検証用に作成したもの）

- ブランチ: `verify/checkout-a`, `verify/checkout-b`, `verify/checkout-a2`, `verify/checkout-b2`, `production-verify`
- ファイル: `verify-a.txt`, `verify-b.txt`, `verify-a2.txt`, `verify-b2.txt`（production / master に取り込まれている）
- `production` 上の `cd-test.yaml` に残った検証用ステップ（Verify checked-out commit / Original step）を
  本番クリーン版（上記 6 の `if` フィルタ版）へ戻す
