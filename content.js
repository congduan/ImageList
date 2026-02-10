// content.js - 提取当前网页中的所有图片

/**
 * 提取网页中的所有图片
 * @return {Array} 图片信息数组
 */
function extractImages() {
  const images = [];
  const seenUrls = new Set();

  // 提取img标签中的图片
  const imgElements = document.querySelectorAll('img');
  console.log('找到', imgElements.length, '个img标签');
  for (const img of imgElements) {
    let src = img.src;
    // 处理相对路径
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      src = new URL(src, window.location.href).href;
    }
    if (src && !seenUrls.has(src)) {
      seenUrls.add(src);
      images.push({
        src: src,
        alt: img.alt || '',
        width: img.width,
        height: img.height,
        type: getImageType(src),
        elementType: 'img'
      });
    }
  }

  // 提取CSS背景图片
  const elements = document.querySelectorAll('*');
  console.log('检查', elements.length, '个元素的背景图片');
  for (const element of elements) {
    try {
      const computedStyle = window.getComputedStyle(element);
      const backgroundImage = computedStyle.backgroundImage;
      if (backgroundImage && backgroundImage !== 'none') {
        // 提取背景图片URL
        const urlMatches = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/g);
        if (urlMatches) {
          for (const match of urlMatches) {
            let url = match.replace(/url\(['"]?(.*?)['"]?\)/, '$1');
            // 处理相对路径
            if (url && !url.startsWith('http') && !url.startsWith('data:')) {
              url = new URL(url, window.location.href).href;
            }
            if (url && !seenUrls.has(url)) {
              seenUrls.add(url);
              images.push({
                src: url,
                alt: '',
                width: 0,
                height: 0,
                type: getImageType(url),
                elementType: 'background'
              });
            }
          }
        }
      }
    } catch (error) {
      // 忽略无法访问的元素
      console.warn('无法获取元素样式:', error);
    }
  }

  console.log('提取到', images.length, '张图片');
  return images;
}

/**
 * 获取图片类型
 * @param {string} url 图片URL
 * @return {string} 图片类型
 */
function getImageType(url) {
  if (url.startsWith('data:image/')) {
    const typeMatch = url.match(/data:image\/(.*?);/);
    return typeMatch ? typeMatch[1] : 'base64';
  }
  
  const extensionMatch = url.match(/\.([^.]+)$/);
  if (extensionMatch) {
    const ext = extensionMatch[1].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'svg', 'webp', 'gif', 'bmp'].includes(ext)) {
      return ext;
    }
  }
  
  return 'unknown';
}

/**
 * 处理来自background script的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractImages') {
    const images = extractImages();
    sendResponse({ images: images });
  }
  return true;
});

// 当页面加载完成时提取图片
window.addEventListener('load', () => {
  const images = extractImages();
  // 存储图片信息到localStorage，供侧边栏使用
  localStorage.setItem('pageImages', JSON.stringify(images));
});

// 当页面DOM变化时重新提取图片
const observer = new MutationObserver(() => {
  const images = extractImages();
  localStorage.setItem('pageImages', JSON.stringify(images));
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});