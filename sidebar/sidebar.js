// sidebar.js - Sidebar logic

/**
 * Initialize sidebar
 */
function initSidebar() {
  // Bind event listeners
  document.getElementById('refresh-btn').addEventListener('click', refreshImages);
  document.getElementById('download-all-btn').addEventListener('click', downloadAllImages);
  document.getElementById('type-filter').addEventListener('change', filterImages);
  
  // Get images on initialization
  refreshImages();
}

/**
 * Refresh images list
 */
async function refreshImages() {
  try {
    let targetTabId;
    
    // Check if opened from new tab
    const urlParams = new URLSearchParams(window.location.search);
    const tabIdParam = urlParams.get('tabId');
    
    if (tabIdParam) {
      // Get tabId from URL parameter
      targetTabId = parseInt(tabIdParam);
    } else {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      targetTabId = tab.id;
    }
    
    // Get images through background script (more reliable communication method)
    const response = await chrome.runtime.sendMessage({ 
      action: 'getImages', 
      tabId: targetTabId 
    });
    const images = response && response.images ? response.images : [];
    
    // Store image data
    window.imagesData = images;
    
    // Render images list
    renderImages(images);
  } catch (error) {
    console.error('Failed to get images:', error);
    // Try to get image data from localStorage
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
 * Render images list
 * @param {Array} images Image information array
 */
function renderImages(images) {
  const imagesList = document.getElementById('images-list');
  const emptyState = document.getElementById('empty-state');
  
  // Clear existing list
  imagesList.innerHTML = '';
  
  if (images.length === 0) {
    // Show empty state
    emptyState.classList.remove('hidden');
    return;
  }
  
  // Hide empty state
  emptyState.classList.add('hidden');
  
  // Add image count information
  const imagesContainer = imagesList.parentElement;
  
  // Remove existing count information (if exists)
  const existingCountInfo = imagesContainer.querySelector('.images-count');
  if (existingCountInfo) {
    existingCountInfo.remove();
  }
  
  // Create count information element
  const countInfo = document.createElement('div');
  countInfo.className = 'images-count';
  countInfo.textContent = `Found ${images.length} images`;
  
  // Insert before images list
  imagesContainer.insertBefore(countInfo, imagesList);
  
  // Render image items
  images.forEach((image, index) => {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    imageItem.dataset.type = image.type;
    
    // Create image preview
    const imgPreview = document.createElement('img');
    imgPreview.className = 'image-preview';
    imgPreview.src = image.src;
    imgPreview.alt = image.alt || `Image ${index + 1}`;
    imgPreview.title = image.alt || `Image ${index + 1}`;
    
    // Add image load error handling
    let errorCount = 0;
    const maxErrors = 2; // Maximum error count to prevent infinite loop
    
    imgPreview.onerror = function() {
      errorCount++;
      
      if (errorCount > maxErrors) {
        console.warn('Image preview failed multiple times, showing placeholder:', image.src);
        // Show default placeholder
        imgPreview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ECannot preview%3C/text%3E%3C/svg%3E';
        return;
      }
      
      console.warn('Image preview failed, trying to use cached data:', image.src);
      
      // Try to get cached image data through background script
      try {
        // Get current tab ID
        let targetTabId;
        const urlParams = new URLSearchParams(window.location.search);
        const tabIdParam = urlParams.get('tabId');
        
        if (tabIdParam) {
          targetTabId = parseInt(tabIdParam);
        } else {
          // If no tabId parameter, try to get current active tab
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
              targetTabId = tabs[0].id;
              sendCachedImageRequest(targetTabId);
            } else {
              // Show default placeholder
              imgPreview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ECannot preview%3C/text%3E%3C/svg%3E';
            }
          });
          return;
        }
        
        function sendCachedImageRequest(tabId) {
          chrome.runtime.sendMessage({ 
            action: 'getCachedImage', 
            tabId: tabId,
            url: image.src 
          }, (response) => {
            if (response && response.success && response.dataUrl && response.dataUrl !== image.src) {
              // Use cached data URL, ensure it's different from original URL
              imgPreview.src = response.dataUrl;
            } else {
              // Show default placeholder
              imgPreview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ECannot preview%3C/text%3E%3C/svg%3E';
            }
          });
        }
        
        sendCachedImageRequest(targetTabId);
      } catch (error) {
        console.error('Failed to get cached image:', error);
        // Show default placeholder
        imgPreview.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23f0f0f0"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="12" fill="%23999" text-anchor="middle" dominant-baseline="middle"%3ECannot preview%3C/text%3E%3C/svg%3E';
      }
    };
    
    // Create image information
    const imgInfo = document.createElement('div');
    imgInfo.className = 'image-info';
    const sizeInfo = image.width > 0 && image.height > 0 ? `${image.width}x${image.height}` : 'Unknown size';
    const typeDisplay = image.type && image.type !== 'unknown' ? image.type.toUpperCase() : 'Image';
    imgInfo.innerHTML = `${typeDisplay}<br>${sizeInfo}`;
    
    // Create download button
    const downloadBtn = document.createElement('button');
    downloadBtn.className = 'download-btn';
    downloadBtn.textContent = 'Download';
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      downloadImage(image.src);
    });
    
    // Create image actions container
    const imgActions = document.createElement('div');
    imgActions.className = 'image-actions';
    imgActions.appendChild(downloadBtn);
    
    // Assemble image item
    imageItem.appendChild(imgPreview);
    imageItem.appendChild(imgInfo);
    imageItem.appendChild(imgActions);
    
    // Add to list
    imagesList.appendChild(imageItem);
  });
}

/**
 * Filter images
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
 * Download single image
 * @param {string} url Image URL
 */
async function downloadImage(url) {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'downloadImage',
      url: url
    });
    
    if (!response.success) {
      console.error('Download failed:', response.error);
      alert('Download failed: ' + response.error);
    }
  } catch (error) {
    console.error('Failed to download image:', error);
    alert('Download failed: ' + error.message);
  }
}

/**
 * Download all images (packaged as zip)
 */
async function downloadAllImages() {
  if (!window.imagesData || window.imagesData.length === 0) {
    alert('No images available for download');
    return;
  }
  
  const filterType = document.getElementById('type-filter').value;
  const filteredImages = window.imagesData.filter(image => {
    if (filterType === 'all') return true;
    if (filterType === 'jpg') return image.type === 'jpg' || image.type === 'jpeg';
    return image.type === filterType;
  });
  
  if (filteredImages.length === 0) {
    alert('No images matching the filter criteria');
    return;
  }
  
  if (!confirm(`Are you sure you want to download ${filteredImages.length} images as a zip file?`)) {
    return;
  }
  
  try {
    // Create JSZip instance
    const zip = new JSZip();
    let successCount = 0;
    let errorCount = 0;
    
    // Download images one by one and add to zip file
    for (let i = 0; i < filteredImages.length; i++) {
      const image = filteredImages[i];
      try {
        // Download image
        const response = await fetch(image.src);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Get image data
        const blob = await response.blob();
        
        // Generate filename
        const filename = `image_${i + 1}.${image.type}`;
        
        // Add to zip file
        zip.file(filename, blob);
        successCount++;
      } catch (error) {
        console.error(`Failed to add image to zip (${i + 1}/${filteredImages.length}):`, error);
        errorCount++;
      }
      
      // Avoid too frequent requests, add short delay
      if (i < filteredImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Generate zip file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Create download link
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `images-collection-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert(`Download completed! Successfully added ${successCount} images to zip file, failed ${errorCount} images.`);
  } catch (error) {
    console.error('Batch download failed:', error);
    alert(`Download failed: ${error.message}`);
  }
}

// Initialize sidebar
initSidebar();