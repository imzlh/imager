const { createApp, ref, onMounted, onUnmounted, nextTick } = Vue;

createApp({
    setup() {
        const tab = ref('home');
        const images = ref([]);
        const slider = ref(null);
        const toast = ref({ show: false, msg: '' });
        const animatingId = ref(null);
        const uiHidden = ref(false);
        const isRefreshing = ref(false);
        const isSwitching = ref(false);
        const isLoading = ref(false);
        const currentIndex = ref(0);

        const tabCache = ref(new Map([
            ['home', { images: [], page: 1, scrollTop: 0, hasMore: true, index: 0 }],
            ['cached', { images: [], page: 1, scrollTop: 0, hasMore: true, total: 0, index: 0 }]
        ]));

        let loading = false;
        let clickTimer = null;
        let clickCount = 0;
        let scrollHandler = null;

        // 触摸滑动相关
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartTime = 0;
        let isHorizontalSwipe = false;
        let isScrolling = false;
        let scrollTimeout = null;
        let startScrollTop = 0;

        const showToast = (msg) => {
            toast.value = { show: true, msg };
            setTimeout(() => toast.value.show = false, 1500);
        };

        const getCurrentCache = () => tabCache.value.get(tab.value);

        const fetchImages = async (isRefresh = false) => {
            if (loading) return;
            loading = true;
            isLoading.value = true;

            const cache = getCurrentCache();
            try {
                const currentPage = isRefresh ? 1 : cache.page;
                const res = await fetch(`/api/images?page=${currentPage}&limit=5`);
                const data = await res.json();

                if (isRefresh || currentPage === 1) {
                    images.value = data.images;
                } else {
                    images.value.push(...data.images);
                }

                if (images.value.length > 100) {
                    images.value = images.value.slice(-100);
                }

                cache.page = currentPage + 1;
                cache.images = [...images.value];
                cache.hasMore = data.hasMore;
            } catch (e) {
                console.error(e);
                showToast('获取失败');
            }

            loading = false;
            isLoading.value = false;
            isRefreshing.value = false;
        };

        const fetchCached = async (isRefresh = false) => {
            if (loading) return;
            loading = true;
            isLoading.value = true;

            const cache = getCurrentCache();
            try {
                const currentPage = isRefresh ? 1 : cache.page;
                const res = await fetch(`/api/cached?page=${currentPage}&limit=10`);
                const data = await res.json();

                if (isRefresh || currentPage === 1) {
                    images.value = data.images;
                } else {
                    images.value.push(...data.images);
                }

                cache.page = currentPage + 1;
                cache.images = [...images.value];
                cache.hasMore = data.hasMore;
                cache.total = data.total;
            } catch (e) {
                console.error(e);
                showToast('获取缓存失败');
            }

            loading = false;
            isLoading.value = false;
        };

        const refresh = async () => {
            if (isRefreshing.value) return;
            isRefreshing.value = true;
            showToast('刷新中...');

            const cache = getCurrentCache();
            cache.page = 1;
            cache.images = [];
            cache.index = 0;
            currentIndex.value = 0;

            if (tab.value === 'home') {
                await fetchImages(true);
            } else {
                await fetchCached(true);
            }

            showToast('已刷新');
        };

        const toggleLike = async (img) => {
            try {
                const res = await fetch(`/api/images/${img.id}/cache`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ imageData: img })
                });
                const data = await res.json();
                img.isCached = data.isCached;
                img.likes = data.likes;
                showToast(data.isCached ? '已收藏' : '取消收藏');

                if (tab.value === 'cached' && !data.isCached) {
                    images.value = images.value.filter(i => i.id !== img.id);
                    const cache = getCurrentCache();
                    cache.images = [...images.value];
                }
            } catch (e) {
                console.error(e);
            }
        };

        const handleClick = (img) => {
            clickCount++;

            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    if (clickCount === 1) {
                        uiHidden.value = !uiHidden.value;
                    }
                    clickCount = 0;
                    clickTimer = null;
                }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                clickCount = 0;
                clickTimer = null;

                if (!img.isCached) {
                    animatingId.value = img.id;
                    setTimeout(() => animatingId.value = null, 600);
                    toggleLike(img);
                }
            }
        };

        const share = async (img) => {
            if (navigator.share) {
                try {
                    await navigator.share({ title: img.title, url: img.url });
                } catch (e) { }
            } else {
                await navigator.clipboard.writeText(img.url);
                showToast('链接已复制');
            }
        };

        const scrollToIndex = (index) => {
            if (!slider.value) return;
            const slideHeight = slider.value.clientHeight;
            slider.value.scrollTo({
                top: index * slideHeight,
                behavior: 'smooth'
            });
        };

        const switchTab = async (t) => {
            if (tab.value === t || isSwitching.value) return;
            isSwitching.value = true;

            const currentCache = getCurrentCache();
            currentCache.index = currentIndex.value;
            currentCache.images = [...images.value];

            tab.value = t;

            const newCache = getCurrentCache();
            images.value = [...newCache.images];
            currentIndex.value = newCache.index || 0;

            if (images.value.length === 0) {
                if (t === 'home') await fetchImages();
                else await fetchCached();
            }

            await nextTick();
            scrollToIndex(currentIndex.value);

            uiHidden.value = false;
            isSwitching.value = false;
        };

        const onTouchStart = (e) => {
            if (isScrolling) return;

            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
            isHorizontalSwipe = false;
            startScrollTop = slider.value?.scrollTop || 0;
        };

        const onTouchMove = (e) => {
            if (!touchStartX || !touchStartY || isScrolling) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = touchStartX - currentX;
            const diffY = touchStartY - currentY;

            // 判断滑动方向
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 10) {
                isHorizontalSwipe = true;
            } else if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 10) {
                isHorizontalSwipe = false;
                // 实时滚动
                if (slider.value) {
                    slider.value.scrollTop = startScrollTop + diffY;
                }
            }
        };

        const onTouchEnd = (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const touchEndTime = Date.now();
            const diffX = touchStartX - touchEndX;
            const diffY = touchStartY - touchEndY;
            const timeDiff = touchEndTime - touchStartTime;
            const threshold = 60;
            const timeThreshold = 300;

            // 处理水平滑动切换标签
            if (isHorizontalSwipe && Math.abs(diffX) > threshold && timeDiff < timeThreshold) {
                e.preventDefault();
                if (diffX > 0) {
                    switchTab(tab.value === 'home' ? 'cached' : 'home');
                } else {
                    switchTab(tab.value === 'cached' ? 'home' : 'cached');
                }
            }
            // 处理垂直滑动切换图片 - 吸附到最近的图片
            else if (!isHorizontalSwipe) {
                const slideHeight = slider.value?.clientHeight || window.innerHeight;
                const currentScrollTop = slider.value?.scrollTop || 0;
                const targetIndex = Math.round(currentScrollTop / slideHeight);
                
                // 限制索引范围
                const newIndex = Math.max(0, Math.min(targetIndex, images.value.length - 1));
                currentIndex.value = newIndex;
                scrollToIndex(newIndex);
            }

            touchStartX = 0;
            touchStartY = 0;
            isHorizontalSwipe = false;
        };

        const onScroll = () => {
            if (!slider.value || isSwitching.value) return;

            if (scrollTimeout) clearTimeout(scrollTimeout);

            scrollTimeout = setTimeout(() => {
                const { scrollTop, clientHeight } = slider.value;
                const index = Math.round(scrollTop / clientHeight);
                currentIndex.value = index;

                const cache = getCurrentCache();
                cache.index = index;
                cache.scrollTop = scrollTop;
            }, 150);

            if (scrollHandler) return;

            scrollHandler = requestAnimationFrame(() => {
                const { scrollTop, scrollHeight, clientHeight } = slider.value;
                const cache = getCurrentCache();

                if (cache.hasMore && scrollTop + clientHeight > scrollHeight - 500) {
                    if (tab.value === 'home') fetchImages();
                    else fetchCached();
                }

                scrollHandler = null;
            });
        };

        const onWheel = (e) => {
            e.preventDefault();

            if (isScrolling) return;

            const delta = e.deltaY;
            const threshold = 50;

            if (Math.abs(delta) < threshold) return;

            isScrolling = true;

            if (delta > 0) {
                // 向下滚动
                if (currentIndex.value < images.value.length - 1) {
                    currentIndex.value++;
                }
            } else {
                // 向上滚动
                if (currentIndex.value > 0) {
                    currentIndex.value--;
                }
            }

            scrollToIndex(currentIndex.value);

            setTimeout(() => {
                isScrolling = false;
            }, 300);
        };

        const formatNum = (n) => {
            if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
            if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
            return n;
        };

        const handleKeydown = (e) => {
            if (e.key === 'r' || e.key === 'R') refresh();
            if (e.key === 'ArrowLeft') switchTab('home');
            if (e.key === 'ArrowRight') switchTab('cached');
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (currentIndex.value > 0) {
                    currentIndex.value--;
                    scrollToIndex(currentIndex.value);
                }
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (currentIndex.value < images.value.length - 1) {
                    currentIndex.value++;
                    scrollToIndex(currentIndex.value);
                }
            }
        };

        onMounted(() => {
            fetchImages().then(() => {
                nextTick(() => {
                    if (slider.value && currentIndex.value > 0) {
                        const slideHeight = slider.value.clientHeight;
                        slider.value.scrollTop = currentIndex.value * slideHeight;
                    }
                });
            });
            window.addEventListener('keydown', handleKeydown);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', handleKeydown);
            if (scrollHandler) cancelAnimationFrame(scrollHandler);
            if (scrollTimeout) clearTimeout(scrollTimeout);
        });

        return {
            tab, images, slider, toast, animatingId, uiHidden, isRefreshing, isSwitching, isLoading, currentIndex,
            toggleLike, handleClick, share, switchTab, onScroll, onWheel,
            onTouchStart, onTouchMove, onTouchEnd,
            formatNum, refresh
        };
    }
}).mount('#app');
