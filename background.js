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
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractImages') {
    // 向content script发送消息，提取图片
    chrome.tabs.sendMessage(sender.tab.id, { action: 'extractImages' }, (response) => {
      if (response && response.images) {
        sendResponse({ images: response.images });
      } else {
        sendResponse({ images: [] });
      }
    });
    return true; // 保持消息通道开放
  } else if (request.action === 'getImages') {
    // 从sidebar接收请求，向content script发送消息提取图片
    const tabId = request.tabId;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { action: 'extractImages' }, (response) => {
        if (response && response.images) {
          sendResponse({ images: response.images });
        } else {
          // 如果content script没有响应，尝试注入并重新发送
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          }).then(() => {
            // 注入后再次尝试发送消息
            chrome.tabs.sendMessage(tabId, { action: 'extractImages' }, (response) => {
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
        }
      });
      return true; // 保持消息通道开放
    } else {
      sendResponse({ images: [] });
    }
  } else if (request.action === 'downloadImage') {
    // 处理图片下载请求
    downloadImage(request.url, request.filename).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('下载图片失败:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放
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
      const base64Data = url.split(',')[1];
      const blob = base64ToBlob(base64Data, `image/${extension}`);
      const blobUrl = URL.createObjectURL(blob);
      
      await chrome.downloads.download({
        url: blobUrl,
        filename: filename || `image.${extension}`,
        saveAs: true
      });
      
      URL.revokeObjectURL(blobUrl);
    } else {
      // 下载普通URL图片
      await chrome.downloads.download({
        url: url,
        filename: filename || getFilenameFromUrl(url),
        saveAs: true
      });
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
 * 初始化插件
 */
function init() {
  console.log('Image List Sidebar 插件已初始化');
  // 可以在这里添加其他初始化逻辑
}

// 初始化插件
init();