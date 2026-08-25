I want 3 groups of changes:

More calculated data for each day: sleep length, nap length, day length (from wake up to sleep start), activity time (not sleep, not nap), activity before nap length, activity after nap length, sleep + nap previous day nap length, sleep + actual day nap length, activity after sleep factor (activity time/sleep time), sleep after activity factor (sleep time/activity time for previous day), any other you suggest that should be visualized


New prediction algorithm, could be complex... You need to find how to name it.
1. In settings user define how many % of extreme values needs to be removed. If choose 10% it means that 5% of earliest and 5% of latest entries will be excluded from calculation. This is checked for each event type so it's not exlude entire days. It will worsk with exlude days in that way - if user decide to remove 10% and we have 500 days then we need to remove 50 entries; if user manualy exclude 20 entries then alghotirm exlude only 30 - 15 earliest, 15 latest.
2. For each event alghotirm calculate some of windows (see below). Then for all windows its calculate real range:
- it takes max value of each window start
- it takes min value of each window end
- the results is range between this two values (from earlier of both to later of both)
Remember that exluded events (by user & alghoritm from 2.1) are not included in this windows
3. For wake up event windows are:
- historic wake up (min and max values from historic events)
- sleep length (min and max sleep length from historic events, and yes, we also exlude extreme values caltulated methric defined in point 1); with that sleep length range we calculate possible wake up range where bed time hour is real bed time hour if it is latest observation or middle (average) of bed time prediction if bed time is not latest observation
- sleep + actual day nap length (min and max sleep + actual day nap length from historic events); with that sleep length range we calculate possible wake up range where bed time hour is real bed time hour if it is latest observation or middle (average) of bed time prediction if bed time is not latest observation
4. For nap start event windows are:
- historic nap start (min and max values from historic events)
- activity before nap length (min and max activity before nap length from historic events); with that activity before nap length range we calculate possible nap start range where wake up hour is real wake up hour if it is latest observation or middle (average) of wake up prediction if wake up is not latest observation
5. For nap end event windows are:
- historic nap end (min and max values from historic events)
- nap length (min and max nap length from historic events); with that nap length range we calculate possible nap end range where nap start hour is real nap start hour if it is latest observation or middle (average) of nap start prediction if nap start is not latest observation
6. For bed time event windows are:
- historic bed time (min and max values from historic events)
- day length (min and max day length from historic events); with that day length range we calculate possible bed time range where nap end hour is real nap end hour if it is latest observation or middle (average) of nap end prediction if nap end is not latest observation
- activity length (min and max activity length from historic events); with that activity length range we calculate possible bed time range where nap end hour is real nap end hour if it is latest observation or middle (average) of nap end prediction if nap end is not latest observation
7. If event should have calculated other windows as well then suggest them.
8. User decide how precise should be declaration. Alghoritm will calculate window. With that it will do 2 thinks:
- calculate metrics: if alghoritm window is smaller than precise then it will be 100%, if its bigger then methric is precise/alg-range
- show window: if alghoritm window is smaller then precise, we will display alghoritm window; if not then we calculate center of that window and use precise to display range with additional metric

More charts for:
- wake up time
- nap start time
- nap end time
- bedtime time
- nap length
- day length
- sleep + nap length
and suggest any other possible charts, i like data visualisation
