/**
 * 简化版图表组件，用于展示减肥趋势
 */

class WxCharts {
    constructor(options) {
        this.canvasId = options.canvasId;
        this.title = options.title || '';
        this.categories = options.categories || [];
        this.data = options.data || [];
        this.width = options.width || 300;
        this.height = options.height || 200;
        this.context = wx.createCanvasContext(this.canvasId);
        this.colors = options.colors || ['#37A2DA', '#67E0E3', '#9FE6B8'];
        this.padding = options.padding || 30;
        this.yAxisFormat = options.yAxisFormat || (val => val);

        this.draw();
    }

    // 绘制图表
    draw() {
        const ctx = this.context;
        const { width, height, padding } = this;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 绘制标题
        if (this.title) {
            ctx.setFontSize(14);
            ctx.setFillStyle('#333333');
            ctx.fillText(this.title, padding, padding / 2);
        }

        // 计算图表区域
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding * 2;

        // 找出数据的最大值和最小值
        const values = this.data;
        const max = Math.max(...values) * 1.1; // 最大值上浮10%
        const min = Math.min(...values) * 0.9; // 最小值下浮10%

        // 绘制Y轴
        this.drawYAxis(ctx, max, min, chartHeight);

        // 绘制X轴
        this.drawXAxis(ctx, chartWidth, chartHeight);

        // 绘制数据线
        this.drawDataLine(ctx, max, min, chartWidth, chartHeight);

        // 绘制数据点
        this.drawDataPoints(ctx, max, min, chartWidth, chartHeight);

        // 绘制到画布
        ctx.draw();
    }

    // 绘制Y轴
    drawYAxis(ctx, max, min, chartHeight) {
        const { padding, yAxisFormat } = this;

        ctx.beginPath();
        ctx.setStrokeStyle('#cccccc');
        ctx.setLineWidth(1);
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, chartHeight + padding);
        ctx.stroke();

        // 绘制Y轴刻度
        const step = (max - min) / 5;
        for (let i = 0; i <= 5; i++) {
            const value = max - step * i;
            const y = this.getYPosition(value, max, min, chartHeight);

            // 绘制刻度线
            ctx.beginPath();
            ctx.moveTo(padding - 5, y);
            ctx.lineTo(padding, y);
            ctx.stroke();

            // 绘制刻度值
            ctx.setFontSize(10);
            ctx.setFillStyle('#666666');
            ctx.fillText(yAxisFormat(value.toFixed(1)), padding - 25, y + 3);
        }
    }

    // 绘制X轴
    drawXAxis(ctx, chartWidth, chartHeight) {
        const { padding, categories } = this;

        ctx.beginPath();
        ctx.setStrokeStyle('#cccccc');
        ctx.setLineWidth(1);
        ctx.moveTo(padding, chartHeight + padding);
        ctx.lineTo(chartWidth + padding, chartHeight + padding);
        ctx.stroke();

        // 计算每个类别的宽度
        const categoriesCount = categories.length;
        const eachSpacing = chartWidth / (categoriesCount - 1 > 0 ? categoriesCount - 1 : 1);

        // 绘制X轴刻度和类别
        for (let i = 0; i < categoriesCount; i++) {
            const x = padding + i * eachSpacing;

            // 绘制刻度线
            ctx.beginPath();
            ctx.moveTo(x, chartHeight + padding);
            ctx.lineTo(x, chartHeight + padding + 5);
            ctx.stroke();

            // 绘制类别
            if (i % Math.ceil(categoriesCount / 6) === 0 || categoriesCount <= 6) {
                ctx.save();
                ctx.setFontSize(10);
                ctx.setFillStyle('#666666');
                ctx.translate(x, chartHeight + padding + 15);
                ctx.rotate(-Math.PI / 4); // 旋转文字，避免重叠
                ctx.fillText(categories[i], 0, 0);
                ctx.restore();
            }
        }
    }

    // 绘制数据线
    drawDataLine(ctx, max, min, chartWidth, chartHeight) {
        const { padding, data, categories } = this;

        if (data.length <= 1) return;

        const categoriesCount = categories.length;
        const eachSpacing = chartWidth / (categoriesCount - 1 > 0 ? categoriesCount - 1 : 1);

        ctx.beginPath();
        ctx.setStrokeStyle(this.colors[0]);
        ctx.setLineWidth(2);

        for (let i = 0; i < data.length; i++) {
            const x = padding + i * eachSpacing;
            const y = this.getYPosition(data[i], max, min, chartHeight);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    // 绘制数据点
    drawDataPoints(ctx, max, min, chartWidth, chartHeight) {
        const { padding, data, categories } = this;
        const categoriesCount = categories.length;
        const eachSpacing = chartWidth / (categoriesCount - 1 > 0 ? categoriesCount - 1 : 1);

        for (let i = 0; i < data.length; i++) {
            const x = padding + i * eachSpacing;
            const y = this.getYPosition(data[i], max, min, chartHeight);

            // 绘制数据点
            ctx.beginPath();
            ctx.setFillStyle(this.colors[0]);
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();

            // 在数据点上方显示数值
            ctx.setFontSize(10);
            ctx.setFillStyle('#333333');
            ctx.fillText(data[i].toFixed(1), x - 10, y - 8);
        }
    }

    // 计算Y坐标位置
    getYPosition(value, max, min, chartHeight) {
        const { padding } = this;
        return chartHeight - (value - min) / (max - min) * chartHeight + padding;
    }
}

module.exports = WxCharts; 