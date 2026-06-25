# LocalSend Easy

An easier LAN file sharing web app. Open the page, upload files, copy the link, and phones or computers on the same local network can download them.

## Features

- Upload a single file
- Upload multiple files at once
- Upload folders
- Drag and drop uploads
- Paste copied files into the page with `Cmd+V` / `Ctrl+V`
- Automatically detects the local LAN IP address
- Uses port `53317` by default
- If the port is already in use, automatically tries following ports such as `53318`, `53319`, and so on
- Automatically generates download links
- Keeps the latest 10 upload records
- Supports access from phones and computers

## Installation

```bash
npm install
```

## Start

```bash
npm start
```

After startup, the terminal will show access URLs, for example:

```text
LocalSend Easy: http://10.0.10.125:53317
Local: http://localhost:53317
```

Devices on the same LAN can open the URL after `LocalSend Easy`.

## Usage

1. Open the web page
2. Select files, select a folder, drag files in, or paste copied files
3. Copy the generated link after the upload finishes
4. Open the link on a phone or another computer to download

Generated links look like this:

```text
http://10.0.10.125:53317/usagi-fe529e1a
```

Here, `usagi` comes from the file name, and `fe529e1a` is the automatically generated 8-character hash.

## Hash Rules

During upload, the full file content is read to generate an 8-character hash.

For a single-file upload, the hash is based on the file content.

For multiple-file or folder uploads, the hash combines the following information:

- File path
- File content

This means:

- Same file name and same content produce the same hash when uploaded again
- Same file name with changed content produces a new hash when uploaded again
- Any file path or content change in a multi-file or folder upload produces a new hash

Computing the hash requires reading the uploaded file completely. Large files require one extra disk read, so this may be slightly slower than generating a hash only from the file name or timestamp.

## Multiple Files and Folders

When uploading multiple files or a folder, the server automatically packages them into a zip file and generates one download link.

## Upload Limits

Current limits:

- Maximum single file size: `4 GiB`
- Maximum `1000` files per upload
- Maximum file size for each file in a multi-file or folder upload: `4 GiB`

Chunked uploads and resumable uploads are not supported yet. If an upload is interrupted, it needs to be uploaded again.

Large files are first written fully to disk and then read fully again to compute the content hash. Multiple-file or folder uploads are also packaged into a zip file, so processing takes longer and requires enough local disk space.

## History

The page shows the latest 10 upload records.

History records and uploaded files are stored locally in the `storage/` directory. After restarting the service, the latest 10 records can still be used.

## Notes

- Sender and receiver must be on the same local network
- The computer firewall must allow LAN access to the local port
- If the browser restricts clipboard permissions, clicking copy will automatically select the link text so it can be copied manually
- The `storage/` directory is not committed to git

## 中文说明

一个更简单的局域网文件分享网页。打开页面，上传文件，复制链接，同一局域网内的手机或电脑即可访问下载。

## 功能

- 支持上传单个文件
- 支持一次上传多个文件
- 支持上传文件夹
- 支持拖拽上传
- 支持复制文件后在页面按 `Cmd+V` / `Ctrl+V` 粘贴上传
- 自动获取本机局域网 IP
- 默认端口为 `53317`
- 如果端口被占用，会自动使用 `53318`、`53319` 等后续端口
- 自动生成下载链接
- 保留最近 10 次上传历史
- 支持手机和电脑访问

## 安装

```bash
npm install
```

## 启动

```bash
npm start
```

启动后终端会显示访问地址，例如：

```text
LocalSend Easy: http://10.0.10.125:53317
Local: http://localhost:53317
```

同一局域网内的设备访问 `LocalSend Easy` 后面的地址即可。

## 使用

1. 打开网页
2. 选择文件、选择文件夹、拖拽文件，或粘贴复制的文件
3. 上传完成后复制生成的链接
4. 在手机或其他电脑上打开链接下载

生成的链接格式类似：

```text
http://10.0.10.125:53317/usagi-fe529e1a
```

其中 `usagi` 来自文件名，后面的 `fe529e1a` 是自动生成的 8 位 hash。

## Hash 规则

上传时会读取完整文件内容，并生成 8 位 hash。

单文件上传时，hash 来自文件内容。

多文件或文件夹上传时，hash 会混合以下信息：

- 文件路径
- 文件内容

因此：

- 文件名相同、内容相同，重新上传会得到相同 hash
- 文件名相同、内容变化，重新上传会得到新的 hash
- 多文件或文件夹中任意文件路径或内容变化，都会得到新的 hash

计算 hash 需要完整读取上传后的文件。大文件会多一次磁盘读取，因此可能比只按文件名或时间戳生成 hash 稍慢。

## 多文件和文件夹

上传多个文件或文件夹时，服务会自动打包成 zip 文件，并生成一个下载链接。

## 上传限制

当前限制：

- 单个文件最大 `4 GiB`
- 单次最多 `1000` 个文件
- 多文件或文件夹上传时，每个文件最大 `4 GiB`

目前没有分片上传，也没有断点续传。上传中断后需要重新上传。

大文件上传会先完整落盘，然后再完整读取一遍计算内容 hash。多文件或文件夹还会额外打包成 zip，因此处理时间会更长，并且需要足够的本地磁盘空间。

## 历史记录

页面会显示最近 10 次上传记录。

历史记录和上传后的文件保存在本地 `storage/` 目录中。服务重启后，最近 10 次记录仍可继续使用。

## 注意事项

- 发送方和接收方需要在同一个局域网内
- 电脑防火墙需要允许本机端口被局域网访问
- 如果浏览器限制剪贴板权限，点击复制时会自动选中链接文本，可手动复制
- `storage/` 目录不会提交到 git
