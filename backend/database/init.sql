-- 创建产品使用记录表
CREATE TABLE IF NOT EXISTS product_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    usage_date TEXT NOT NULL,
    update_date TEXT,
    quantity REAL NOT NULL,
    notes TEXT,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 添加update_date列(如果不存在)
PRAGMA foreign_keys=off;
BEGIN TRANSACTION;

-- 检查并添加update_date列
SELECT CASE
    WHEN COUNT(*) = 0 THEN
        -- 列不存在，添加列
        (ALTER TABLE product_usages ADD COLUMN update_date TEXT)
    ELSE
        -- 列已存在，不做任何事
        ('SELECT 1')
END
FROM pragma_table_info('product_usages') 
WHERE name = 'update_date';

-- 更新现有记录的update_date值
UPDATE product_usages 
SET update_date = usage_date 
WHERE update_date IS NULL OR update_date = '';

COMMIT;
PRAGMA foreign_keys=on; 