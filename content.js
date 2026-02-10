// content.js - 提取当前网页中的所有图片

/**
 * 通过magic number检测图片类型
 * @param {ArrayBuffer} buffer 图片文件的ArrayBuffer
 * @return {string} 图片类型
 */
function detectImageTypeByMagicNumber(buffer) {
  const view = new DataView(buffer);
  
  // 检测JPEG
  if (view.byteLength >= 2 && view.getUint8(0) === 0xFF && view.getUint8(1) === 0xD8) {
    return 'jpg';
  }
  
  // 检测PNG
  if (view.byteLength >= 8 && 
      view.getUint8(0) === 0x89 && 
      view.getUint8(1) === 0x50 && 
      view.getUint8(2) === 0x4E && 
      view.getUint8(3) === 0x47 && 
      view.getUint8(4) === 0x0D && 
      view.getUint8(5) === 0x0A && 
      view.getUint8(6) === 0x1A && 
      view.getUint8(7) === 0x0A) {
    return 'png';
  }
  
  // 检测GIF
  if (view.byteLength >= 6 && 
      ((view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x46) ||
       (view.getUint8(0) === 0x47 && view.getUint8(1) === 0x49 && view.getUint8(2) === 0x66))) {
    return 'gif';
  }
  
  // 检测BMP
  if (view.byteLength >= 2 && 
      view.getUint8(0) === 0x42 && 
      view.getUint8(1) === 0x4D) {
    return 'bmp';
  }
  
  // 检测WebP
  if (view.byteLength >= 12 && 
      view.getUint8(0) === 0x52 && 
      view.getUint8(1) === 0x49 && 
      view.getUint8(2) === 0x46 && 
      view.getUint8(3) === 0x46 && 
      view.getUint8(8) === 0x57 && 
      view.getUint8(9) === 0x45 && 
      view.getUint8(10) === 0x42 && 
      view.getUint8(11) === 0x50) {
    return 'webp';
  }
  
  // 检测AVIF
  if (view.byteLength >= 12 && 
      view.getUint32(4) === 0x41564946 && // 'AVIF' in ASCII
      view.getUint32(8) === 0x312E30) {    // '1.0' in ASCII
    return 'avif';
  }
  
  // 检测ICO
  if (view.byteLength >= 6 && 
      view.getUint16(0) === 0 && 
      view.getUint16(2) === 1) {
    return 'ico';
  }
  
  // 检测TIFF
  if (view.byteLength >= 4 && 
      ((view.getUint16(0) === 0x4D4D && view.getUint16(2) === 42) || // Big-endian
       (view.getUint16(0) === 0x4949 && view.getUint16(2) === 42))) { // Little-endian
    return 'tiff';
  }
  
  return 'unknown';
}

/**
 * 尝试通过fetch获取图片并检测其类型
 * @param {string} url 图片URL
 * @return {Promise<string>} 图片类型
 */
async function getImageTypeByFetch(url) {
  try {
    // 尝试多种fetch配置
    const fetchConfigs = [
      {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      },
      {
        method: 'GET',
        mode: 'no-cors',
        cache: 'default'
      }
    ];
    
    let response;
    for (const config of fetchConfigs) {
      try {
        response = await fetch(url, config);
        if (response.ok || response.type === 'opaque') {
          break;
        }
      } catch (error) {
        // 尝试下一个配置
        continue;
      }
    }
    
    if (!response) {
      throw new Error('所有fetch配置都失败');
    }
    
    // 对于no-cors请求，我们无法获取响应体，但可以从其他信息推断
    if (response.type === 'opaque') {
      // 尝试从Content-Type头推断类型
      const contentType = response.headers.get('Content-Type');
      if (contentType && contentType.startsWith('image/')) {
        const typeMatch = contentType.match(/image\/(.*)/);
        if (typeMatch) {
          const type = typeMatch[1].toLowerCase();
          // 处理常见的MIME类型
          if (type === 'jpeg') return 'jpg';
          if (['jpg', 'png', 'gif', 'webp', 'bmp', 'svg+xml', 'avif', 'tiff', 'ico'].includes(type)) {
            return type.replace('+xml', '');
          }
        }
      }
      throw new Error('无法获取响应体');
    }
    
    const buffer = await response.arrayBuffer();
    return detectImageTypeByMagicNumber(buffer);
  } catch (error) {
    console.warn('通过fetch检测图片类型失败:', url, error);
    
    // 最后尝试：从URL路径和参数中推断类型
    const urlLower = url.toLowerCase();
    if (urlLower.includes('image/jpeg') || urlLower.includes('image/jpg')) return 'jpg';
    if (urlLower.includes('image/png')) return 'png';
    if (urlLower.includes('image/gif')) return 'gif';
    if (urlLower.includes('image/webp')) return 'webp';
    if (urlLower.includes('image/bmp')) return 'bmp';
    if (urlLower.includes('image/svg')) return 'svg';
    if (urlLower.includes('image/avif')) return 'avif';
    if (urlLower.includes('image/tiff')) return 'tiff';
    if (urlLower.includes('image/ico')) return 'ico';
    
    return 'unknown';
  }
}

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
      // 尝试获取图片尺寸，优先使用naturalWidth/naturalHeight获取原始尺寸
      let width = 0;
      let height = 0;
      
      // 尝试获取原始尺寸
      if (img.naturalWidth && img.naturalHeight) {
        width = img.naturalWidth;
        height = img.naturalHeight;
      } 
      // 尝试获取当前显示尺寸
      else if (img.width && img.height) {
        width = img.width;
        height = img.height;
      }
      // 尝试从style或属性中获取尺寸
      else {
        // 从style属性中获取
        const styleWidth = img.style.width;
        const styleHeight = img.style.height;
        if (styleWidth) {
          const widthMatch = styleWidth.match(/(\d+)px/);
          if (widthMatch) width = parseInt(widthMatch[1]);
        }
        if (styleHeight) {
          const heightMatch = styleHeight.match(/(\d+)px/);
          if (heightMatch) height = parseInt(heightMatch[1]);
        }
        // 从width/height属性中获取
        if (!width && img.getAttribute('width')) {
          width = parseInt(img.getAttribute('width')) || 0;
        }
        if (!height && img.getAttribute('height')) {
          height = parseInt(img.getAttribute('height')) || 0;
        }
      }
      
      // 先通过URL获取类型，然后尝试通过magic number验证
      let type = getImageType(src);
      
      // 对于可能的图片，尝试通过fetch获取并检测magic number
      if (type === 'unknown' || ['jpg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tiff', 'ico'].includes(type)) {
        // 注意：这里不等待异步操作完成，避免阻塞提取过程
        getImageTypeByFetch(src).then(detectedType => {
          if (detectedType !== 'unknown') {
            // 更新已提取图片的类型
            const existingImage = images.find(img => img.src === src);
            if (existingImage) {
              existingImage.type = detectedType;
            }
          }
        });
      }
      
      images.push({
        src: src,
        alt: img.alt || '',
        width: width,
        height: height,
        type: type,
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
        // 使用更可靠的正则表达式处理各种URL格式
        const urlMatches = backgroundImage.match(/url\((['"]?)(.*?)\1\)/g);
        if (urlMatches) {
          for (const match of urlMatches) {
            // 提取URL内容，处理带引号和不带引号的情况
            let url;
            const quoteMatch = match.match(/url\(['"](.*?)['"]\)/);
            if (quoteMatch) {
              url = quoteMatch[1];
            } else {
              const noQuoteMatch = match.match(/url\((.*?)\)/);
              url = noQuoteMatch ? noQuoteMatch[1] : '';
            }
            
            if (url) {
              // 处理相对路径
              if (!url.startsWith('http') && !url.startsWith('data:')) {
                try {
                  url = new URL(url, window.location.href).href;
                } catch (error) {
                  console.warn('无法解析URL:', url, error);
                  continue;
                }
              }
              
              // 处理data URL中的SVG
              if (url.startsWith('data:image/svg+xml')) {
                // 确保data URL格式正确
                try {
                  // 解码URL编码的SVG内容
                  const decodedUrl = decodeURIComponent(url);
                  if (!seenUrls.has(decodedUrl)) {
                    seenUrls.add(decodedUrl);
                    images.push({
                      src: decodedUrl,
                      alt: '',
                      width: 0,
                      height: 0,
                      type: 'svg',
                      elementType: 'background'
                    });
                  }
                } catch (error) {
                  console.warn('处理SVG data URL失败:', error);
                  // 如果解码失败，使用原始URL
                  if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    images.push({
                      src: url,
                      alt: '',
                      width: 0,
                      height: 0,
                      type: 'svg',
                      elementType: 'background'
                    });
                  }
                }
              } else {
                // 处理普通URL
                if (!seenUrls.has(url)) {
                  seenUrls.add(url);
                  // 先通过URL获取类型，然后尝试通过magic number验证
                  let type = getImageType(url);
                  
                  // 对于可能的图片，尝试通过fetch获取并检测magic number
                  if (type === 'unknown' || ['jpg', 'png', 'gif', 'webp', 'bmp', 'avif', 'tiff', 'ico'].includes(type)) {
                    // 注意：这里不等待异步操作完成，避免阻塞提取过程
                    getImageTypeByFetch(url).then(detectedType => {
                      if (detectedType !== 'unknown') {
                        // 更新已提取图片的类型
                        const existingImage = images.find(img => img.src === url);
                        if (existingImage) {
                          existingImage.type = detectedType;
                        }
                      }
                    });
                  }
                  
                  images.push({
                    src: url,
                    alt: '',
                    width: 0,
                    height: 0,
                    type: type,
                    elementType: 'background'
                  });
                }
              }
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
  
  // 尝试从URL路径中提取文件扩展名
  // 处理URL参数和哈希部分
  const cleanUrl = url.split('?')[0].split('#')[0];
  
  // 提取扩展名，处理各种情况
  let extension = '';
  
  // 方法1：从URL末尾提取扩展名
  const extensionMatch = cleanUrl.match(/\.([^.]+)$/);
  if (extensionMatch) {
    extension = extensionMatch[1].toLowerCase();
  }
  
  // 方法2：如果没有找到扩展名，尝试从URL路径中查找图片格式关键词
  const urlLower = url.toLowerCase();
  if (!extension) {
    if (urlLower.includes('jpg') || urlLower.includes('jpeg')) {
      return 'jpg';
    } else if (urlLower.includes('png')) {
      return 'png';
    } else if (urlLower.includes('svg')) {
      return 'svg';
    } else if (urlLower.includes('webp')) {
      return 'webp';
    } else if (urlLower.includes('gif')) {
      return 'gif';
    } else if (urlLower.includes('bmp')) {
      return 'bmp';
    } else if (urlLower.includes('ico')) {
      return 'ico';
    } else if (urlLower.includes('tiff') || urlLower.includes('tif')) {
      return 'tiff';
    } else if (urlLower.includes('apng')) {
      return 'apng';
    } else if (urlLower.includes('avif')) {
      return 'avif';
    }
  } else {
    // 处理找到的扩展名
    extension = extension.toLowerCase();
    // 统一处理jpeg和jpg
    if (extension === 'jpeg') {
      return 'jpg';
    }
    // 支持更多图片格式
    if (['jpg', 'png', 'svg', 'webp', 'gif', 'bmp', 'ico', 'tiff', 'tif', 'apng', 'avif'].includes(extension)) {
      return extension;
    }
  }
  
  // 最后尝试：检查URL中是否包含图片格式的MIME类型或其他线索
  if (urlLower.includes('image/jpeg') || urlLower.includes('image/jpg')) {
    return 'jpg';
  }
  if (urlLower.includes('image/png')) {
    return 'png';
  }
  if (urlLower.includes('image/svg')) {
    return 'svg';
  }
  if (urlLower.includes('image/webp')) {
    return 'webp';
  }
  if (urlLower.includes('image/gif')) {
    return 'gif';
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
// 使用条件声明，避免重复声明错误
if (!window.imageListObserver) {
  window.imageListObserver = new MutationObserver(() => {
    const images = extractImages();
    localStorage.setItem('pageImages', JSON.stringify(images));
  });

  window.imageListObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}