/**
 * Train Search - Highlights trains matching query (arrival/departure numbers)
 * Supports multi-train search with comma separation: "123, 456, 789"
 * Smart viewport positioning to show maximum number of matching trains
 */
(function () {
  function init() {
    window.addEventListener('trainSearchQuery', (e) => {
      const q = (e.detail && e.detail.query || '').toLowerCase();
      applyHighlights(q);
    });
  }

  function applyHighlights(query) {
    const bars = document.querySelectorAll('.train-bar');
    if (!bars.length) return;

    if (!query) {
      bars.forEach(el => {
        el.classList.remove('is-highlighted', 'is-dimmed');
      });
      return;
    }

    // Parse comma-separated train numbers
    const trainNumbers = query
      .split(',')
      .map(num => num.trim())
      .filter(num => num.length > 0);

    if (trainNumbers.length === 0) {
      // No valid input, clear all highlights
      bars.forEach(el => {
        el.classList.remove('is-highlighted', 'is-dimmed');
      });
      return;
    }

    // Highlight matching trains
    const matchedBars = [];
    bars.forEach(el => {
      const arr = (el.dataset.arrival || '').toLowerCase();
      const dep = (el.dataset.departure || '').toLowerCase();
      
      // Check if any of the search numbers match this train
      const isMatch = trainNumbers.some(searchNum => 
        (arr && arr.includes(searchNum)) || (dep && dep.includes(searchNum))
      );

      if (isMatch) {
        el.classList.add('is-highlighted');
        el.classList.remove('is-dimmed');
        matchedBars.push(el);
      } else {
        el.classList.remove('is-highlighted');
        el.classList.add('is-dimmed');
      }
    });

    if (matchedBars.length > 0) {
      // Smart viewport positioning to show maximum matches
      scrollToOptimalPosition(matchedBars);
    }
  }

  /**
   * Calculates and scrolls to the optimal viewport position that shows
   * the maximum number of highlighted trains simultaneously.
   * Takes into account current viewport width and train positions.
   */
  function scrollToOptimalPosition(matchedBars) {
    const scheduleWrapper = document.querySelector('.schedule-wrapper');
    if (!scheduleWrapper) return;

    const viewportWidth = scheduleWrapper.clientWidth;
    
    // Get all train positions (left offset on timeline)
    const trainPositions = matchedBars.map(bar => ({
      element: bar,
      left: bar.offsetLeft,
      right: bar.offsetLeft + bar.offsetWidth
    }));

    // Sort by left position
    trainPositions.sort((a, b) => a.left - b.left);

    // Find the viewport position that captures the most trains
    let bestScrollLeft = 0;
    let maxVisibleTrains = 0;

    // Strategy: For each train, consider it as the leftmost visible train
    // and count how many other trains fit in the viewport from that point
    trainPositions.forEach(train => {
      const potentialScrollLeft = train.left;
      const viewportRight = potentialScrollLeft + viewportWidth;

      // Count how many trains are visible in this viewport
      const visibleCount = trainPositions.filter(t => 
        t.left >= potentialScrollLeft && t.left < viewportRight
      ).length;

      if (visibleCount > maxVisibleTrains) {
        maxVisibleTrains = visibleCount;
        bestScrollLeft = potentialScrollLeft;
      }
    });

    // If all trains fit in viewport, center them
    if (maxVisibleTrains === trainPositions.length) {
      const firstTrain = trainPositions[0].left;
      const lastTrain = trainPositions[trainPositions.length - 1].right;
      const totalSpan = lastTrain - firstTrain;

      if (totalSpan < viewportWidth) {
        // Center the group of trains
        bestScrollLeft = firstTrain - (viewportWidth - totalSpan) / 2;
      }
    }

    // Apply scroll (ensure non-negative)
    scheduleWrapper.scrollLeft = Math.max(0, bestScrollLeft);

    console.log(`🔍 Sökning: ${matchedBars.length} träffar, visar ${maxVisibleTrains} samtidigt`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
