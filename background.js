// background.js - 插件后台逻辑

/**
 * 处理插件图标点击事件，打开侧边栏
 */
chrome.action.onClicked.addListener((tab) => {
  if (chrome.sidePanel) {
    // 使用sidePanel API（Chrome 94+）
    try {
      // 先设置侧边栏选项
      chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: 'sidebar/sidebar.html',
        enabled: true
      });
      // 直接打开侧边栏（在用户手势上下文中）
      chrome.sidePanel.open({ tabId: tab.id });
    } catch (error) {
      console.error('打开侧边栏失败:', error);
      // 降级方案：在新标签页中打开
      chrome.tabs.create({
        url: chrome.runtime.getURL('sidebar/sidebar.html') + '?tabId=' + tab.id
      });
    }
  } else {
    // 降级方案：在新标签页中打开
    chrome.tabs.create({
      url: chrome.runtime.getURL('sidebar/sidebar.html') + '?tabId=' + tab.id
    });
  }
});

/**
 * 处理来自content script和sidebar的消息
 */

// Action处理函数映射
const actionHandlers = {
  /**
   * 处理提取图片请求
   */
  extractImages: (request, sender, sendResponse) => {
    // 向content script发送消息，提取图片
    chrome.tabs.sendMessage(sender.tab.id, { action: 'extractImages' }, (response) => {
      if (response && response.images) {
        sendResponse({ images: response.images });
      } else {
        sendResponse({ images: [] });
      }
    });
    return true; // 保持消息通道开放
  },

  /**
   * 处理获取图片请求
   */
  getImages: (request, sender, sendResponse) => {
    // 从sidebar接收请求，向content script发送消息提取图片
    const tabId = request.tabId;
    if (tabId) {
      // 直接尝试注入content script，确保它存在
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(() => {
        // 注入后发送消息
        chrome.tabs.sendMessage(tabId, { action: 'extractImages' }, (response) => {
          // 忽略错误，直接检查响应
          if (response && response.images) {
            sendResponse({ images: response.images });
          } else {
            sendResponse({ images: [] });
          }
        });
      }).catch((error) => {
        console.error('注入content script失败:', error);
        sendResponse({ images: [] });
      });
      return true; // 保持消息通道开放
    } else {
      sendResponse({ images: [] });
    }
  },

  /**
   * 处理获取缓存图片请求
   */
  getCachedImage: (request, sender, sendResponse) => {
    // 从sidebar接收请求，向content script发送消息获取缓存图片
    const tabId = request.tabId;
    const url = request.url;
    if (tabId && url) {
      // 直接尝试注入content script，确保它存在
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(() => {
        // 注入后发送消息
        chrome.tabs.sendMessage(tabId, { 
          action: 'getCachedImage', 
          url: url 
        }, (response) => {
          // 忽略错误，直接检查响应
          if (response) {
            sendResponse(response);
          } else {
            sendResponse({ success: false, error: '未收到响应' });
          }
        });
      }).catch((error) => {
        console.error('注入content script失败:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // 保持消息通道开放
    } else {
      sendResponse({ success: false, error: '缺少必要参数' });
    }
  },

  /**
   * 处理图片下载请求
   */
  downloadImage: (request, sender, sendResponse) => {
    // 处理图片下载请求
    downloadImage(request.url, request.filename).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('下载图片失败:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
  },

  /**
   * 处理批量下载请求
   */
  downloadAllImages: (request, sender, sendResponse) => {
    // 处理批量下载请求（逐个下载）
    const images = request.images;
    if (images && images.length > 0) {
      downloadAllImagesAsZip(images).then((result) => {
        sendResponse({ 
          success: result.success, 
          successCount: result.successCount, 
          errorCount: result.errorCount 
        });
      }).catch((error) => {
        console.error('批量下载失败:', error);
        sendResponse({ success: false, error: error.message });
      });
    } else {
      sendResponse({ success: false, error: '没有图片可下载' });
    }
    return true; // 保持消息通道开放
  }
};

// 消息监听器
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const action = request.action;
  if (action && actionHandlers[action]) {
    return actionHandlers[action](request, sender, sendResponse);
  } else {
    console.warn('未处理的action:', action);
    sendResponse({ success: false, error: '未知的action' });
  }
});

/**
 * 下载图片到本地
 * @param {string} url 图片URL
 * @param {string} filename 文件名
 * @return {Promise} 下载结果
 */
async function downloadImage(url, filename) {
  try {
    // 处理base64图片
    if (url.startsWith('data:image/')) {
      // 从base64数据中提取图片类型
      const typeMatch = url.match(/data:image\/(.*?);/);
      const extension = typeMatch ? typeMatch[1].split(';')[0] : 'png';
      
      // 直接使用data URL下载
      await chrome.downloads.download({
        url: url,
        filename: filename || `image.${extension}`,
        saveAs: true
      });
    } else {
      try {
        // 尝试从网络下载普通URL图片
        await chrome.downloads.download({
          url: url,
          filename: filename || getFilenameFromUrl(url),
          saveAs: true
        });
      } catch (error) {
        console.error('网络下载失败，尝试从缓存获取:', error);
        // 尝试从content script获取缓存数据
        try {
          // 获取当前活动标签页
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab) {
            // 向content script发送消息，请求获取缓存数据
            const cacheData = await new Promise((resolve, reject) => {
              chrome.tabs.sendMessage(tab.id, { 
                action: 'getCachedImage', 
                url: url 
              }, (response) => {
                if (response && response.success && response.dataUrl) {
                  resolve(response.dataUrl);
                } else {
                  reject(new Error('缓存中未找到图片'));
                }
              });
            });
            
            // 使用缓存数据下载
            let extension = 'png'; // 默认扩展名
            
            // 从缓存数据中提取类型信息
            if (cacheData.startsWith('data:image/')) {
              // 从data URL中提取类型
              const typeMatch = cacheData.match(/data:image\/(.*?);/);
              if (typeMatch) {
                const mimeType = typeMatch[1];
                // 处理常见的MIME类型
                if (mimeType === 'jpeg') {
                  extension = 'jpg';
                } else if (['png', 'gif', 'webp', 'bmp', 'svg+xml', 'avif', 'tiff', 'ico'].includes(mimeType)) {
                  extension = mimeType.replace('+xml', '');
                }
              }
            } else {
              // 尝试从原始URL中提取扩展名
              const urlExtension = getExtensionFromUrl(url);
              if (urlExtension) {
                // 验证是否为有效的图片扩展名
                const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff', 'ico'];
                if (validExtensions.includes(urlExtension.toLowerCase())) {
                  extension = urlExtension;
                }
              }
            }
            
            await chrome.downloads.download({
              url: cacheData,
              filename: filename || `image_${Date.now()}.${extension}`,
              saveAs: true
            });
            
            console.log('从缓存成功下载图片');
            return; // 成功下载，退出函数
          }
        } catch (cacheError) {
          console.error('缓存获取也失败:', cacheError);
          // 尝试其他缓存策略
          try {
            // 对于常见的图片格式，尝试使用fetch获取
            const response = await fetch(url, {
              mode: 'no-cors',
              cache: 'force-cache'
            });
            
            if (response.ok || response.type === 'opaque') {
              // 对于no-cors请求，我们无法获取响应体，但可以尝试再次下载
              await chrome.downloads.download({
                url: url,
                filename: filename || getFilenameFromUrl(url),
                saveAs: true
              });
              return; // 成功下载，退出函数
            }
          } catch (fetchError) {
            console.error('fetch缓存获取也失败:', fetchError);
          }
        }
        
        // 所有尝试都失败，抛出原始错误
        throw error;
      }
    }
  } catch (error) {
    console.error('下载图片失败:', error);
    throw error;
  }
}

/**
 * 将base64数据转换为Blob对象
 * @param {string} base64Data base64数据
 * @param {string} contentType 内容类型
 * @return {Blob} Blob对象
 */
function base64ToBlob(base64Data, contentType) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: contentType });
}

/**
 * 从URL中提取文件名
 * @param {string} url 图片URL
 * @return {string} 文件名
 */
function getFilenameFromUrl(url) {
  // 从URL路径中提取文件名
  const path = new URL(url).pathname;
  const filename = path.split('/').pop();
  if (filename) {
    return filename;
  }
  
  // 如果没有文件名，生成一个随机文件名
  const timestamp = Date.now();
  const extension = getExtensionFromUrl(url) || 'png';
  return `image_${timestamp}.${extension}`;
}

/**
 * 从URL中提取文件扩展名
 * @param {string} url 图片URL
 * @return {string} 文件扩展名
 */
function getExtensionFromUrl(url) {
  const match = url.match(/\.([^.]+)$/);
  if (match) {
    return match[1].split('?')[0].split('#')[0];
  }
  return null;
}

/**
 * 批量下载图片
 * @param {Array} images 图片信息数组
 * @return {Promise} 下载结果
 */
async function downloadAllImagesAsZip(images) {
  try {
    let successCount = 0;
    let errorCount = 0;

    // 逐个下载图片
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      try {
        // 为每张图片生成一个唯一的文件名
        const filename = `image_${i + 1}_${Date.now()}.${image.type}`;
        await downloadImage(image.src, filename);
        successCount++;
      } catch (error) {
        console.error(`下载图片失败 (${i + 1}/${images.length}):`, error);
        errorCount++;
      }

      // 避免请求过于频繁，添加短暂延迟
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`批量下载完成: 成功 ${successCount} 张, 失败 ${errorCount} 张`);
    return { success: true, successCount, errorCount };
  } catch (error) {
    console.error('批量下载失败:', error);
    throw error;
  }
}

/**
 * 初始化插件
 */
function init() {
  console.log('Image List Sidebar 插件已初始化');
  // 可以在这里添加其他初始化逻辑
}

// 初始化插件
init();