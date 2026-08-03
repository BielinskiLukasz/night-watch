Issues:
1. I dont see wake, bedtime, nap start and nap end times there (only : is visible)
2. Bedtime is before nap, should be after
3. Newest record is last one, should be on top
4. Sleep should be calculated for last night, not future (for 1.04 sleep is between bedtime 31.03 and wake 1.04)
5. Header with colums names should be always visible when scrolling table
6. Table should take more space on horizontal view (margins like vertical view)
7. AAS = Activity / Combined, not sure if now its calculated correctly
8. SAA = Comnbined / Activity, also not sure if calculated correctly

Issues v2:
1. Each screen have big white spaces on left and right
2. Bedtime is still before nap, should be after
3. Sleep should be calculated for last night, not future (for 1.04 sleep is between bedtime 31.03 and wake 1.04)
4. Sleep calculation is invalid. It should be calculated since yesterday bedtime to today wake (not sleep in this calendar day)
5. AAS/SAA need to be checked after fixing point 5

Issues v3:
1. SAA should be calculated for days without nap as well
2. Newest record is last one, should be on top
3. Move 'Add event' to line up with other buttons, and change name of that button (is for adding more than one event via save more)
4. 

Ideas:
1. More charts
2. More relations for event forecasts:
    - activity before nap / sleep factor => nap start
    - activity before nap / nap factor => nap end
3. Accuracy works for TIF
4. Replace SAA (its 1/AAS only) with other factor like day length / sleep factor
5. Add TIF min and TIF max values to metrics screen
