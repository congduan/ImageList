// sidebar.js - 侧边栏逻辑

/**
 * 侧边栏初始化
 */
function initSidebar() {
  // 绑定事件监听器
  document.getElementById('refresh-btn').addEventListener('click', refreshImages);
  document.getElementById('download-all-btn').addEventListener('click', downloadAllImages);
  document.getElementById('type-filter').addEventListener('change', filterImages);
  
  // 初始化时获取图片
  refreshImages();
}

/**
 * 刷新图片列表
 */
async function refreshImages() {
  try {
    let targetTabId;
    
    // 检查是否是从新标签页打开的
    const urlParams = new URLSearchParams(window.location.search);
    const tabIdParam = urlParams.get('tabId');
    
    if (tabIdParam) {
      // 从URL参数获取tabId
      targetTabId = parseInt(tabIdParam);
    } else {
      // 获取当前活动标签页
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTabId = tab.id;
    }
    
    // 通过background script获取图片（更可靠的通信方式）
    const response = await chrome.runtime.sendMessage({ 
      action: 'getImages', 
      tabId: targetTabId 
    });
    const images = response && response.images ? response.images : [];
    
    // 存储图片数据
    window.imagesData = images;
    
    // 渲染图片列表
    renderImages(images);
  } catch (error) {
    console.error('获取图片失败:', error);
    // 尝试从localStorage获取图片数据
    const storedImages = localStorage.getItem('pageImages');
    if (storedImages) {
      const images = JSON.parse(storedImages);
      window.imagesData = images;
      renderImages(images);
    } else {
      renderImages([]);
    }
  }
}

/**
 * 渲染图片列表
 * @param {Array} images 图片信息数组
 */
function renderImages(images) {
  const imagesList = document.getElementById('images-list');
  const emptyState = document.getElementById('empty-state');
  
  // 清空现有列表
  imagesList.innerHTML = '';
  
  if (images.length === 0) {
    // 显示空状态
    emptyState.classList.remove('hidden');
    return;
  }
  
  // 隐藏空状态
  emptyState.classList.add('hidden');
  
  // 渲染图片项
  images.forEach((image, index) => {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.dataset.type = image.type;
    
    // 创建图片预览
    const imgPreview = document.createElement('img');
    imgPreview.className = 'image-preview';
    imgPreview.src = image.src;
    imgPreview.alt = image.alt || `Image ${index + 1}`;
    imgPreview.title = image.alt || `Image ${index + 1}`;
    
    // 创建图片信息
    const imgInfo = document.createElement('div');
    imgInfo.className = 'image-info';
    imgInfo.textContent = `${image.type.toUpperCase()}`;
    
    // 创建下载按钮
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = '下载';
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadImage(image.src);
    });
    
    // 创建图片操作容器
    const imgActions = document.createElement('div');
    imgActions.className = 'image-actions';
    imgActions.appendChild(downloadBtn);
    
    // 组装图片项
    imageItem.appendChild(imgPreview);
    imageItem.appendChild(imgInfo);
    imageItem.appendChild(imgActions);
    
    // 添加到列表
    imagesList.appendChild(imageItem);
  });
}

/**
 * 过滤图片
 */
function filterImages() {
  const filterType = document.getElementById('type-filter').value;
  const imageItems = document.querySelectorAll('.image-item');
  
  imageItems.forEach(item => {
    const itemType = item.dataset.type;
    
    if (filterType === 'all' || 
        (filterType === 'jpg' && (itemType === 'jpg' || itemType === 'jpeg')) ||
        itemType === filterType) {
      item.style.display = 'block';
    } else {
      item.style.display = 'none';
    }
  });
}

/**
 * 下载单个图片
 * @param {string} url 图片URL
 */
async function downloadImage(url) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadImage',
      url: url
    });
    
    if (!response.success) {
      console.error('下载失败:', response.error);
      alert('下载失败: ' + response.error);
    }
  } catch (error) {
    console.error('下载图片失败:', error);
    alert('下载失败: ' + error.message);
  }
}

/**
 * 下载所有图片
 */
async function downloadAllImages() {
  if (!window.imagesData || window.imagesData.length === 0) {
    alert('当前没有可下载的图片');
    return;
  }
  
  const filterType = document.getElementById('type-filter').value;
  const filteredImages = window.imagesData.filter(image => {
    if (filterType === 'all') return true;
    if (filterType === 'jpg') return image.type === 'jpg' || image.type === 'jpeg';
    return image.type === filterType;
  });
  
  if (filteredImages.length === 0) {
    alert('没有符合条件的图片可下载');
    return;
  }
  
  if (!confirm(`确定要下载 ${filteredImages.length} 张图片吗？`)) {
    return;
  }
  
  // 逐个下载图片
  let successCount = 0;
  for (const image of filteredImages) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'downloadImage',
        url: image.src
      });
      if (response.success) {
        successCount++;
      }
    } catch (error) {
      console.error('下载图片失败:', error);
    }
  }
  
  alert(`下载完成，成功 ${successCount} 张，失败 ${filteredImages.length - successCount} 张`);
}

// 初始化侧边栏
initSidebar();