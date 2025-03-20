import React, { useState, useEffect } from 'react';
import { View, Text, Button, TextInput, StyleSheet, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { request } from '../../utils/request';
import Navbar from '../../components/Navbar';

const app = getApp();

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: ''
  });
  
  // 加载产品列表
  const loadProducts = async () => {
    setLoading(true);
    try {
      const userId = wx.getStorageSync('userId');
      const res = await request({
        url: '/api/products/list',
        method: 'GET',
        data: { user_id: userId }
      });
      
      if (res.code === 200) {
        setProducts(res.data || []);
      } else {
        wx.showToast({
          title: res.message || '获取产品列表失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('获取产品列表错误:', error);
      wx.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 添加产品
  const handleAddProduct = async () => {
    // 表单验证
    if (!productForm.name.trim()) {
      wx.showToast({ title: '请输入产品名称', icon: 'none' });
      return;
    }
    
    if (!productForm.price.trim() || isNaN(Number(productForm.price)) || Number(productForm.price) <= 0) {
      wx.showToast({ title: '请输入有效的价格', icon: 'none' });
      return;
    }
    
    if (!productForm.stock.trim() || isNaN(Number(productForm.stock)) || Number(productForm.stock) < 0) {
      wx.showToast({ title: '请输入有效的库存数量', icon: 'none' });
      return;
    }
    
    try {
      const userId = wx.getStorageSync('userId');
      const res = await request({
        url: '/api/products/add',
        method: 'POST',
        data: {
          user_id: userId,
          name: productForm.name,
          description: productForm.description,
          price: Number(productForm.price),
          stock: Number(productForm.stock)
        }
      });
      
      if (res.code === 200) {
        wx.showToast({
          title: '添加产品成功',
          icon: 'success'
        });
        setModalVisible(false);
        resetForm();
        loadProducts(); // 重新加载产品列表
      } else {
        wx.showToast({
          title: res.message || '添加产品失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('添加产品错误:', error);
      wx.showToast({
        title: '网络错误，请稍后重试',
        icon: 'none'
      });
    }
  };
  
  // 删除产品
  const handleDeleteProduct = async (productId) => {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此产品吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const userId = wx.getStorageSync('userId');
            const result = await request({
              url: '/api/products/delete',
              method: 'POST',
              data: {
                user_id: userId,
                product_id: productId
              }
            });
            
            if (result.code === 200) {
              wx.showToast({
                title: '删除产品成功',
                icon: 'success'
              });
              loadProducts(); // 重新加载产品列表
            } else {
              wx.showToast({
                title: result.message || '删除产品失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('删除产品错误:', error);
            wx.showToast({
              title: '网络错误，请稍后重试',
              icon: 'none'
            });
          }
        }
      }
    });
  };
  
  // 重置表单
  const resetForm = () => {
    setProductForm({
      name: '',
      description: '',
      price: '',
      stock: ''
    });
  };
  
  // 页面加载时获取产品列表
  useEffect(() => {
    loadProducts();
  }, []);
  
  return (
    <View style={styles.container}>
      <Navbar title="产品管理" />
      
      <View style={styles.header}>
        <Text style={styles.title}>产品列表</Text>
        <Button 
          title="添加产品" 
          onPress={() => setModalVisible(true)}
        />
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>加载中...</Text>
        </View>
      ) : (
        <ScrollView style={styles.productList}>
          {products.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>暂无产品，请点击"添加产品"按钮创建</Text>
            </View>
          ) : (
            products.map((product) => (
              <View key={product.id} style={styles.productItem}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productDescription}>{product.description || '暂无描述'}</Text>
                  <View style={styles.productDetails}>
                    <Text>价格: ¥{product.price}</Text>
                    <Text>库存: {product.stock}</Text>
                    <Text>所属店铺: {product.store_name || '默认店铺'}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteProduct(product.id)}
                >
                  <Text style={styles.deleteButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
      
      {/* 添加产品弹窗 */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加产品</Text>
            
            <TextInput
              style={styles.input}
              placeholder="产品名称 *"
              value={productForm.name}
              onChangeText={(text) => setProductForm({...productForm, name: text})}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="产品描述"
              multiline
              numberOfLines={4}
              value={productForm.description}
              onChangeText={(text) => setProductForm({...productForm, description: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="产品价格 *"
              keyboardType="numeric"
              value={productForm.price}
              onChangeText={(text) => setProductForm({...productForm, price: text})}
            />
            
            <TextInput
              style={styles.input}
              placeholder="库存数量 *"
              keyboardType="numeric"
              value={productForm.stock}
              onChangeText={(text) => setProductForm({...productForm, stock: text})}
            />
            
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.buttonText}>取消</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleAddProduct}
              >
                <Text style={styles.buttonText}>确认添加</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  productList: {
    padding: 10,
  },
  productItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  productDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  deleteButton: {
    backgroundColor: '#ff4d4f',
    padding: 8,
    borderRadius: 4,
    marginLeft: 10,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    padding: 12,
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  confirmButton: {
    backgroundColor: '#1890ff',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
}); 