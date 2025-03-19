/**
 * 生命周期函数--监听页面显示
 */
onShow() {
    // 检查是否需要刷新数据
    const needRefresh = wx.getStorageSync('statisticsNeedRefresh');
    if (needRefresh) {
        console.log('检测到需要刷新统计数据标志，重新加载数据');
        this.loadStatisticsData();
        // 清除刷新标志
        wx.removeStorageSync('statisticsNeedRefresh');
    }
}, 