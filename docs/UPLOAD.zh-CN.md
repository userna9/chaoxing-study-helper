# 上传到 GitHub

建议仓库名：`chaoxing-study-helper`。项目已经包含 README、许可证、源码、安装文件和 GitHub Actions；不需要上传原工作目录。

## 网页上传

1. 解压项目 ZIP。
2. 在 GitHub 新建空仓库；本地已经有 README、许可证和忽略文件，无需再次生成。
3. 在仓库页面选择 **Add file → Upload files**，上传解压后项目文件夹内的内容。
4. 确认 `README.md`、`package.json`、`src/`、`test/`、`dist/`、`.github/` 直接位于仓库根目录。点开头的文件也要保留。
5. 提交文件，查看 Actions 中的构建测试结果。

不要只上传 ZIP 文件，也不要上传 `node_modules/`、`reports/` 或原会话截图。网页上传方式见 [GitHub 官方说明](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)。

## 使用 Git

在项目文件夹打开终端，先将示例远程地址替换为你新建仓库的地址，再执行：

```sh
git init -b main
git add .
git commit -m "Initial release: v0.6.8"
git remote add origin "https://github.com/YOUR_USERNAME/chaoxing-study-helper.git"
git push -u origin main
```

如 Git 提示需要作者信息，请使用你自己的 Git 用户名和提交邮箱。此项目没有预设作者身份、远程仓库或访问令牌。

## 上传后安装

在仓库中打开 `dist/chaoxing-study-helper.user.js` 并选择 Raw；油猴可以安装或复制其中完整代码。也可以新建 `v0.6.8` Release 并将该文件作为附件。

仓库地址确定后，再决定是否为脚本配置 `@updateURL` 和 `@downloadURL`；不要保留他人的仓库地址。
