**Deprecated**   交易所API升级，当前版本废弃

整体思路，还是以两个为主：
1. 监听order变化，根据order查找对应task，通过对task的策略进行check，进行下单等操作；
2. 轮询task信息，对task进行check，查漏补缺；

