# Push Key 管理 API 测试说明

## 新增的API接口

### 1. 添加 push_key
- **接口**: `POST /setting/add`
- **参数**:
  - `push_key`: 要添加的push_key (必填)
  - `admin_token`: 管理员token (必填，用于鉴权)

### 2. 删除 push_key
- **接口**: `POST /setting/delete`
- **参数**:
  - `push_key`: 要删除的push_key (必填)
  - `admin_token`: 管理员token (必填，用于鉴权)

### 3. 获取 push_key 列表
- **接口**: `GET /setting/list` 或 `POST /setting/list`
- **参数**:
  - `admin_token`: 管理员token (必填，用于鉴权)

## 鉴权方式

支持两种鉴权方式：
1. **Web界面登录**: 通过cookie验证
2. **API Token**: 通过admin_token参数验证

Token可以通过以下方式传递：
- URL参数: `?admin_token=your_token`
- HTTP Header: `admin-token: your_token`
- HTTP Header: `Authorization: Bearer your_token`

## 测试命令示例

假设你的服务运行在 `http://localhost:3010`，admin_token 为 `your_admin_token_here`

### 1. 获取push_key列表
```bash
curl -X POST "http://localhost:3010/setting/list?admin_token=your_admin_token_here"
```

### 2. 添加push_key
```bash
curl -X POST "http://localhost:3010/setting/add" \
  -d "push_key=test_key_123&admin_token=your_admin_token_here"
```

### 3. 删除push_key
```bash
curl -X POST "http://localhost:3010/setting/delete" \
  -d "push_key=test_key_123&admin_token=your_admin_token_here"
```

### 4. 使用Header方式传递token
```bash
curl -X POST "http://localhost:3010/setting/list" \
  -H "admin-token: your_admin_token_here"
```

## 响应格式

### 成功响应
```json
{
  "code": 1,
  "msg": "操作成功",
  "data": {
    "push_key": "test_key_123"  // 仅add/delete接口返回
  }
}
```

### 列表响应
```json
{
  "code": 1,
  "msg": "获取push_key列表成功！",
  "data": {
    "push_keys": ["key1", "key2", "key3"],
    "count": 3
  }
}
```

### 错误响应
```json
{
  "code": 0,
  "msg": "错误信息"
}
```

## 注意事项

1. **admin_token获取**:
   - 首次安装时自动生成
   - 可在Web管理界面的系统设置中查看和修改

2. **安全性**:
   - admin_token具有完全的管理权限，请妥善保管
   - 建议定期更换token

3. **限制**:
   - push_key长度必须在3-50个字符之间
   - 不能删除最后一个push_key
   - push_key不能重复

4. **持久化**:
   - 所有修改都会立即写入 `config/setting.js` 文件
   - 修改后无需重启服务即可生效

