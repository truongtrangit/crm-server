----
Feature mới.
Ở tab quản lý tác vụ, thiết kế thêm bộ lọc để Owner, Admin có thể filter theo phòng ban, nhóm trong phòng ban
Manager có thể filter theo phòng ban (trường hợp manager thuộc nhiều phòng ban có thể biết chính xác phòng ban nào có những tác vụ nào) và nhóm trong phòng ban
User sẽ chỉ thấy được các tác vụ được assign cho nó

có thể filter theo tác vụ thuộc nhóm sự kiện nào (user mới, biz mới, ... ) list này sẽ phải đồng bộ với list khi tạo mới sự kiện, tốt nhất nó sẽ là constant nằm 1 chỗ và chỉ sửa 1 lần khi cần thêm mới, xoá đi
---
Tôi nghị là sẽ thêm search nữa để có thể search nhân viên được assign, khách hàng, tên sự kiện


----

Bây giờ cần thực hiện phân quyền, trả về danh sách các event tương ứng với quyền theo yêu cầu sau:
1. Tất cả các event chưa có người phụ trách -> Ai cũng có thể thấy event này.
2. Vì event sẽ được đồng bộ từ bên thứ 3 về, nó có thông tin người phụ trách, nhưng người phụ trách này ko có trong hệ thống hoặc chưa được đồng bộ với thông tin staff trong hệ thống thì ai cũng có thể thấy event này
3. Khi đã đồng bộ với thông tin trong hệ thống thì có flag báo là đã đồng bộ để biết được event đã assign cho user trong hệ thống rồi phân quyền thêm theo các yêu cầu bên dưới. Tuy nhiên, sau này vẫn có thể bấm đồng bộ tiếp, nếu thông tin nguòi phụ trách lại ko tìm thấy trong hệ thống thì flag này lại bằng false.
4. Owner, admin sẽ có full quyền với event, thấy tất cả các event, toàn quyền với event, có thể assign event cho bất kỳ nhân viên nào kể cả mình. Các quyền với event tham khảo theo các rule của manager và staff
5. Manager 
5.1. sẽ chỉ thấy các event mình phụ trách hoặc nhân viên mình phụ trách
5.2. Có thể assign event cho bản thân hoặc nhân viên dưới quyền mình.
5.3. Khi tạo event, chỉ có thể assign cho chính mình hoặc nhân viên dưới quyền mình
5.3. Ở tab quản lý tác vụ cũng sẽ chỉ thấy các tác vụ cần thực hiện của bản thân hoặc của nhân viên dưới quyền mình
6. Staff 
6.1. Ngoài có thể thấy các event theo rule 1 và 2. thì chỉ có thể thấy các event được assign cho bản thân
6.2. Khi tạo event chỉ có thể assign cho bản thân
6.3. Ở tab quản lý tác vụ cũng sẽ chỉ thấy các tác vụ cần thực hiện của bản thân.

Tất cả các rule đều sử dụng tính năng search, fileter ở tab tác vụ bình thường, nhưng kết qủa trả ra sẽ khác tuỳ vào rule



