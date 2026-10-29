---
tags: []
created: 2026-10-29
updated: 2026-10-29
---

# Git

> 本笔记由 XMind 导图自动转换，图片已提取至 `99-附件/Git/`。
> 原导图见 `xmind导图/git/git.xmind`。

## 常用命令
- **添加到暂存区**
  git add
  常用git add . 全部添加
- **提交到commit区**
  git commit
- **查看差异**
  git diff
  - **j -- 往上一行移动**
    k-- 往下一行移动
    f -- 往下移动一整页
    b -- 往上移动一整页
    q -- 退出
- **查看提交记录**
  git log
- **查看状态**
  git status
- **初始化**
  git init
  创建.git文件夹进行项目的追踪
## 忽略文件
.gitignore
## 回滚相关
- **撤销工作区的改动**
  git restore
  git restore . 回滚全部
  回滚单独的文件只需要在后面直接追加要回滚的文件即可，如git restore main.c
  撤销暂存区的改动
  git restore --staged
  后面追加规则同上
- **reset的三种模式**
  ![[99-附件/Git/63a8bqd33dek2slcbf1l9st00s.png]]
  - **git reset -- hard HEAD~X**
    X代表回滚到之前的哪一次
    当前指向的是HEAD，当前的上一次是HEAD~1
  - **git revert**
    git revert HEAD
    回滚最近一次的commit
    回滚的同时提交历史保留了之前的记录（相当于提交一个反向的commit）
## 分支
- **创建分支**
  git branch
  单独的git branch是查看当前仓库的所有分支
  git branch xxx 是创建新分支
  如git branch feature/xxx
  git branch -d xxx
  删掉该分支
- **切换分支**
  git switch xxx
- **创建加切换**
  git switch -c xxx
  或
  git checkout - b xxx
- **合并**
  git merge xxx
  主要要切到你当前需要合并的分支中，也就是让别的分支合并到当前分支
  - **处理合并冲突：**
    找到对应的文件处理git标记出的冲突，然后正常add和commit
- **将branch的base挪到master最新的提交中**
  git rebase
  用法：
  git rebase master
  处理完冲突后执行
  git rebase --continue
- **将改动存起来**
  git stash
  一般用于开发分支到一半需要切换主分支的情况
  取出存起来的改动
  git stash pop
- 增加新的工作区（简化git stash来回切换的场景，每个worktree有自己的工作区和暂存区，共享一个提交历史）
  git worktree add
  git worktree list
  git worktree remove directory
  - **example:**
    git worktree add -b feature/xxx directory master
    - **-b feature/xxx**
      创建的分支名
    - **diretory**
      放在哪个目录
    - **master**
      基于哪个分支
## 提交到远程
git push
