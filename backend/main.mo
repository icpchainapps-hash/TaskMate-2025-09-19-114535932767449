import AccessControl "authorization/access-control";
import OutCall "http-outcalls/outcall";
import Stripe "stripe/stripe";
import Registry "blob-storage/registry";
import Principal "mo:base/Principal";
import OrderedMap "mo:base/OrderedMap";
import Iter "mo:base/Iter";
import Debug "mo:base/Debug";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Array "mo:base/Array";
import Nat "mo:base/Nat";
import Tasks "tasks";
import Feed "feed";
import Offers "offers";

persistent actor {
    let accessControlState = AccessControl.initState();

    public shared ({ caller }) func initializeAccessControl() : async () {
        AccessControl.initialize(accessControlState, caller);
    };

    public query ({ caller }) func getCallerUserRole() : async AccessControl.UserRole {
        AccessControl.getUserRole(accessControlState, caller);
    };

    public shared ({ caller }) func assignCallerUserRole(user : Principal, role : AccessControl.UserRole) : async () {
        AccessControl.assignRole(accessControlState, caller, user, role);
    };

    public query ({ caller }) func isCallerAdmin() : async Bool {
        AccessControl.isAdmin(accessControlState, caller);
    };

    public type AccountType = {
        #individual;
        #business;
    };

    public type Accreditation = {
        id : Text;
        name : Text;
        issuingOrganization : Text;
        dateIssued : Time.Time;
        expirationDate : ?Time.Time;
        verified : Bool;
    };

    public type WorkHistory = {
        taskId : Text;
        title : Text;
        description : Text;
        category : Text;
        budget : Nat;
        completionDate : Time.Time;
        taskType : Tasks.TaskType;
    };

    public type UserProfile = {
        name : Text;
        bio : Text;
        skills : [Text];
        averageRating : Float;
        completedJobs : Nat;
        phone : Text;
        email : Text;
        profilePicture : ?Text;
        policeCheckStatus : PoliceCheckStatus;
        displayName : Text;
        accountType : AccountType;
        organizationName : ?Text;
        abn : ?Text;
        businessIndustry : ?Text;
        accreditations : [Accreditation];
        workHistory : [WorkHistory];
    };

    public type PoliceCheckStatus = {
        #notRequested;
        #inProgress;
        #verified;
    };

    transient let principalMap = OrderedMap.Make<Principal>(Principal.compare);
    transient let textMap = OrderedMap.Make<Text>(Text.compare);

    var userProfiles = principalMap.empty<UserProfile>();

    public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
        principalMap.get(userProfiles, caller);
    };

    public query func getUserProfile(user : Principal) : async ?UserProfile {
        principalMap.get(userProfiles, user);
    };

    public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
        userProfiles := principalMap.put(userProfiles, caller, profile);
    };

    public query ({ caller }) func hasDisplayName() : async Bool {
        switch (principalMap.get(userProfiles, caller)) {
            case null false;
            case (?profile) profile.displayName != "";
        };
    };

    public shared ({ caller }) func requestPoliceCheck() : async () {
        let profile = principalMap.get(userProfiles, caller);
        switch (profile) {
            case null Debug.trap("Profile not found");
            case (?p) {
                let updatedProfile : UserProfile = {
                    p with policeCheckStatus = #inProgress;
                };
                userProfiles := principalMap.put(userProfiles, caller, updatedProfile);
            };
        };
    };

    public query ({ caller }) func getPoliceCheckStatus() : async PoliceCheckStatus {
        let profile = principalMap.get(userProfiles, caller);
        switch (profile) {
            case null #notRequested;
            case (?p) p.policeCheckStatus;
        };
    };

    public type Task = Tasks.Task;
    public type TaskStatus = Tasks.TaskStatus;
    public type TaskType = Tasks.TaskType;
    public type TimeSlot = Tasks.TimeSlot;
    public type AvailabilityCalendar = Tasks.AvailabilityCalendar;

    var tasks = textMap.empty<Task>();

    public shared ({ caller }) func createTask(task : Task) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can create tasks");
        };

        if (not areTimeSlotsUnique(task.availabilityCalendar)) {
            Debug.trap("Duplicate time slots found in availability calendar");
        };

        tasks := textMap.put(tasks, task.id, task);
    };

    func areTimeSlotsUnique(calendar : AvailabilityCalendar) : Bool {
        let timeSlots = calendar.timeSlots;
        for (i in Iter.range(0, timeSlots.size() - 1)) {
            for (j in Iter.range(i + 1, timeSlots.size() - 1)) {
                if (timeSlots[i].startTime == timeSlots[j].startTime and timeSlots[i].endTime == timeSlots[j].endTime) {
                    return false;
                };
            };
        };
        true;
    };

    public query func getTasks() : async [Task] {
        Iter.toArray(textMap.vals(tasks));
    };

    public shared ({ caller }) func archiveTask(taskId : Text) : async () {
        let task = textMap.get(tasks, taskId);
        switch (task) {
            case null Debug.trap("Task not found");
            case (?t) {
                if (t.requester != caller) {
                    Debug.trap("Unauthorized: Only task owner can archive");
                };
                let updatedTask : Task = {
                    t with isArchived = true;
                };
                tasks := textMap.put(tasks, taskId, updatedTask);
            };
        };
    };

    public shared ({ caller }) func unarchiveTask(taskId : Text) : async () {
        let task = textMap.get(tasks, taskId);
        switch (task) {
            case null Debug.trap("Task not found");
            case (?t) {
                if (t.requester != caller) {
                    Debug.trap("Unauthorized: Only task owner can unarchive");
                };
                let updatedTask : Task = {
                    t with isArchived = false;
                };
                tasks := textMap.put(tasks, taskId, updatedTask);
            };
        };
    };

    public query ({ caller }) func getArchivedTasks() : async [Task] {
        Iter.toArray(
            Iter.filter(
                textMap.vals(tasks),
                func(t : Task) : Bool {
                    t.requester == caller and t.isArchived
                },
            )
        );
    };

    public type OfferStatus = Offers.OfferStatus;
    public type Offer = Offers.Offer;

    var offers = textMap.empty<Offer>();

    public shared ({ caller }) func makeOffer(offer : Offer) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can make offers");
        };

        let task = textMap.get(tasks, offer.taskId);
        switch (task) {
            case null Debug.trap("Task not found");
            case (?t) {
                if (not isTimeSlotAvailable(t.availabilityCalendar, offer.selectedTimeSlot)) {
                    Debug.trap("Selected time slot is not available");
                };
                offers := textMap.put(offers, offer.id, offer);

                let notification : Notification = {
                    id = offer.id # "_notification";
                    userId = t.requester;
                    offerId = ?offer.id;
                    taskId = ?offer.taskId;
                    notificationType = #offer;
                    createdAt = Time.now();
                    isRead = false;
                    principal = Principal.toText(caller);
                };
                notifications := textMap.put(notifications, notification.id, notification);
            };
        };
    };

    func isTimeSlotAvailable(calendar : AvailabilityCalendar, selectedSlot : ?TimeSlot) : Bool {
        switch (selectedSlot) {
            case null true;
            case (?slot) {
                for (availableSlot in calendar.timeSlots.vals()) {
                    if (availableSlot.startTime == slot.startTime and availableSlot.endTime == slot.endTime) {
                        return true;
                    };
                };
                false;
            };
        };
    };

    public query func getOffers() : async [Offer] {
        Iter.toArray(textMap.vals(offers));
    };

    public shared ({ caller }) func approveOffer(offerId : Text) : async () {
        let offer = textMap.get(offers, offerId);
        switch (offer) {
            case null Debug.trap("Offer not found");
            case (?o) {
                let task = textMap.get(tasks, o.taskId);
                switch (task) {
                    case null Debug.trap("Task not found");
                    case (?t) {
                        if (t.requester != caller) {
                            Debug.trap("Unauthorized: Only task owner can approve offers");
                        };

                        let updatedOffer : Offer = {
                            o with status = #approved;
                        };
                        offers := textMap.put(offers, offerId, updatedOffer);

                        let updatedTask : Task = {
                            t with status = #assigned; assignedTasker = ?o.tasker;
                        };
                        tasks := textMap.put(tasks, t.id, updatedTask);

                        let notification : Notification = {
                            id = offerId # "_approved";
                            userId = o.tasker;
                            offerId = ?offerId;
                            taskId = ?o.taskId;
                            notificationType = #offer;
                            createdAt = Time.now();
                            isRead = false;
                            principal = Principal.toText(caller);
                        };
                        notifications := textMap.put(notifications, notification.id, notification);
                    };
                };
            };
        };
    };

    public shared ({ caller }) func rejectOffer(offerId : Text) : async () {
        let offer = textMap.get(offers, offerId);
        switch (offer) {
            case null Debug.trap("Offer not found");
            case (?o) {
                let task = textMap.get(tasks, o.taskId);
                switch (task) {
                    case null Debug.trap("Task not found");
                    case (?t) {
                        if (t.requester != caller) {
                            Debug.trap("Unauthorized: Only task owner can reject offers");
                        };

                        let updatedOffer : Offer = {
                            o with status = #rejected;
                        };
                        offers := textMap.put(offers, offerId, updatedOffer);

                        let notification : Notification = {
                            id = offerId # "_rejected";
                            userId = o.tasker;
                            offerId = ?offerId;
                            taskId = ?o.taskId;
                            notificationType = #offer;
                            createdAt = Time.now();
                            isRead = false;
                            principal = Principal.toText(caller);
                        };
                        notifications := textMap.put(notifications, notification.id, notification);
                    };
                };
            };
        };
    };

    public type Message = {
        id : Text;
        taskId : Text;
        sender : Principal;
        recipient : Principal;
        content : Text;
        timestamp : Time.Time;
    };

    var messages = textMap.empty<Message>();

    public shared ({ caller }) func sendMessage(message : Message) : async () {
        let task = textMap.get(tasks, message.taskId);
        switch (task) {
            case null Debug.trap("Task not found");
            case (?_t) {
            };
        };
        messages := textMap.put(messages, message.id, message);

        let notification : Notification = {
            id = message.id # "_message";
            userId = message.recipient;
            offerId = null;
            taskId = ?message.taskId;
            notificationType = #message;
            createdAt = Time.now();
            isRead = false;
            principal = Principal.toText(caller);
        };
        notifications := textMap.put(notifications, notification.id, notification);
    };

    public query func getMessagesForTask(taskId : Text) : async [Message] {
        let task = textMap.get(tasks, taskId);
        switch (task) {
            case null Debug.trap("Task not found");
            case (?_t) {
            };
        };
        Iter.toArray(
            Iter.filter(
                textMap.vals(messages),
                func(m : Message) : Bool {
                    m.taskId == taskId;
                },
            )
        );
    };

    var configuration : ?Stripe.StripeConfiguration = null;

    public query func isStripeConfigured() : async Bool {
        return configuration != null;
    };

    public shared ({ caller }) func setStripeConfiguration(config : Stripe.StripeConfiguration) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
            Debug.trap("Unauthorized: Only admins can perform this action");
        };
        configuration := ?config;
    };

    private func getStripeConfiguration() : Stripe.StripeConfiguration {
        switch (configuration) {
            case null Debug.trap("Stripe needs to be first configured");
            case (?value) value;
        };
    };

    public func getStripeSessionStatus(sessionId : Text) : async Stripe.StripeSessionStatus {
        await Stripe.getSessionStatus(getStripeConfiguration(), sessionId, transform);
    };

    public shared ({ caller }) func createCheckoutSession(items : [Stripe.ShoppingItem], successUrl : Text, cancelUrl : Text) : async Text {
        await Stripe.createCheckoutSession(getStripeConfiguration(), caller, items, successUrl, cancelUrl, transform);
    };

    public query func transform(input : OutCall.TransformationInput) : async OutCall.TransformationOutput {
        OutCall.transform(input);
    };

    let registry = Registry.new();

    public shared ({ caller }) func registerFileReference(path : Text, hash : Text) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can register file references");
        };
        Registry.add(registry, path, hash);
    };

    public query ({ caller }) func getFileReference(path : Text) : async Registry.FileReference {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can get file references");
        };
        Registry.get(registry, path);
    };

    public query ({ caller }) func listFileReferences() : async [Registry.FileReference] {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can list file references");
        };
        Registry.list(registry);
    };

    public shared ({ caller }) func dropFileReference(path : Text) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can drop file references");
        };
        Registry.remove(registry, path);
    };

    public type Reaction = {
        userId : Principal;
        taskId : Text;
        emoji : Text;
    };

    var reactions = textMap.empty<Reaction>();

    public shared ({ caller }) func addReaction(taskId : Text, emoji : Text) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can react to tasks");
        };
        let reaction : Reaction = {
            userId = caller;
            taskId = taskId;
            emoji = emoji;
        };
        reactions := textMap.put(reactions, Principal.toText(caller) # taskId, reaction);

        let task = textMap.get(tasks, taskId);
        switch (task) {
            case null Debug.trap("Task not found");
            case (?t) {
                if (t.requester != caller) {
                    let notification : Notification = {
                        id = Principal.toText(caller) # taskId # "_reaction";
                        userId = t.requester;
                        offerId = null;
                        taskId = ?taskId;
                        notificationType = #reaction;
                        createdAt = Time.now();
                        isRead = false;
                        principal = Principal.toText(caller);
                    };
                    notifications := textMap.put(notifications, notification.id, notification);
                };
            };
        };
    };

    public shared ({ caller }) func removeReaction(taskId : Text) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can remove reactions");
        };
        reactions := textMap.delete(reactions, Principal.toText(caller) # taskId);
    };

    public query func getReactionsForTask(taskId : Text) : async [Reaction] {
        Iter.toArray(
            Iter.filter(
                textMap.vals(reactions),
                func(r : Reaction) : Bool {
                    r.taskId == taskId;
                },
            )
        );
    };

    public type Comment = {
        id : Text;
        taskId : Text;
        userId : Principal;
        text : Text;
        timestamp : Time.Time;
    };

    var comments = textMap.empty<Comment>();

    public shared ({ caller }) func addComment(taskId : Text, text : Text) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can comment on tasks");
        };
        let comment : Comment = {
            id = Principal.toText(caller) # taskId # Int.toText(Time.now());
            taskId = taskId;
            userId = caller;
            text = text;
            timestamp = Time.now();
        };
        comments := textMap.put(comments, comment.id, comment);

        let task = textMap.get(tasks, taskId);
        switch (task) {
            case null Debug.trap("Task not found");
            case (?t) {
                if (t.requester != caller) {
                    let ownerNotification : Notification = {
                        id = comment.id # "_owner";
                        userId = t.requester;
                        offerId = null;
                        taskId = ?taskId;
                        notificationType = #comment;
                        createdAt = Time.now();
                        isRead = false;
                        principal = Principal.toText(caller);
                    };
                    notifications := textMap.put(notifications, ownerNotification.id, ownerNotification);
                };

                let previousCommenters = Iter.toArray(
                    Iter.filter(
                        textMap.vals(comments),
                        func(c : Comment) : Bool {
                            c.taskId == taskId and c.userId != caller;
                        },
                    )
                );

                for (c in previousCommenters.vals()) {
                    let commenterNotification : Notification = {
                        id = comment.id # "_commenter_" # Principal.toText(c.userId);
                        userId = c.userId;
                        offerId = null;
                        taskId = ?taskId;
                        notificationType = #comment;
                        createdAt = Time.now();
                        isRead = false;
                        principal = Principal.toText(c.userId);
                    };
                    notifications := textMap.put(notifications, commenterNotification.id, commenterNotification);
                };
            };
        };
    };

    public query func getCommentsForTask(taskId : Text) : async [Comment] {
        Iter.toArray(
            Iter.filter(
                textMap.vals(comments),
                func(c : Comment) : Bool {
                    c.taskId == taskId;
                },
            )
        );
    };

    public type NotificationType = {
        #offer;
        #message;
        #taskUpdate;
        #comment;
        #reaction;
        #swapClaim;
        #swapStatusChange;
    };

    public type Notification = {
        id : Text;
        userId : Principal;
        offerId : ?Text;
        taskId : ?Text;
        notificationType : NotificationType;
        createdAt : Time.Time;
        isRead : Bool;
        principal : Text;
    };

    var notifications = textMap.empty<Notification>();

    var clearedNotifications = principalMap.empty<[Text]>();

    func containsTextArray(arr : [Text], value : Text) : Bool {
        for (v in arr.vals()) {
            if (v == value) {
                return true;
            };
        };
        false;
    };

    public query ({ caller }) func getNotifications() : async [Notification] {
        let cleared = switch (principalMap.get(clearedNotifications, caller)) {
            case null [];
            case (?ids) ids;
        };

        Iter.toArray(
            Iter.filter(
                textMap.vals(notifications),
                func(n : Notification) : Bool {
                    n.userId == caller and not containsTextArray(cleared, n.id);
                },
            )
        );
    };

    public shared ({ caller }) func markNotificationAsRead(notificationId : Text) : async () {
        let notification = textMap.get(notifications, notificationId);
        switch (notification) {
            case null Debug.trap("Notification not found");
            case (?n) {
                if (n.userId != caller) {
                    Debug.trap("Unauthorized: Cannot mark notification as read");
                };
                let updatedNotification : Notification = {
                    n with isRead = true;
                };
                notifications := textMap.put(notifications, notificationId, updatedNotification);
            };
        };
    };

    public shared ({ caller }) func clearNotification(notificationId : Text) : async () {
        let notification = textMap.get(notifications, notificationId);
        switch (notification) {
            case null Debug.trap("Notification not found");
            case (?n) {
                if (n.userId != caller) {
                    Debug.trap("Unauthorized: Cannot clear notification");
                };
                let currentCleared = switch (principalMap.get(clearedNotifications, caller)) {
                    case null [];
                    case (?ids) ids;
                };
                clearedNotifications := principalMap.put(clearedNotifications, caller, Array.append(currentCleared, [notificationId]));
            };
        };
    };

    public shared ({ caller }) func clearAllNotifications() : async () {
        let userNotifications = Iter.toArray(
            Iter.filter(
                textMap.vals(notifications),
                func(n : Notification) : Bool {
                    n.userId == caller;
                },
            )
        );

        let notificationIds = Iter.toArray(Iter.map(Iter.fromArray(userNotifications), func(n : Notification) : Text { n.id }));

        clearedNotifications := principalMap.put(clearedNotifications, caller, notificationIds);
    };

    public query ({ caller }) func getMyCreatedTasks() : async [Task] {
        Iter.toArray(
            Iter.filter(
                textMap.vals(tasks),
                func(t : Task) : Bool {
                    t.requester == caller;
                },
            )
        );
    };

    public query ({ caller }) func getMyOfferedTasks() : async [Task] {
        let myOffers = Iter.toArray(
            Iter.filter(
                textMap.vals(offers),
                func(o : Offer) : Bool {
                    o.tasker == caller;
                },
            )
        );

        let myTaskIds = Iter.toArray(Iter.map(Iter.fromArray(myOffers), func(o : Offer) : Text { o.taskId }));

        Iter.toArray(
            Iter.filter(
                textMap.vals(tasks),
                func(t : Task) : Bool {
                    for (id in myTaskIds.vals()) {
                        if (t.id == id) {
                            return true;
                        };
                    };
                    false;
                },
            )
        );
    };

    public type Payment = {
        id : Text;
        taskId : Text;
        amount : Nat;
        tasker : Principal;
        requester : Principal;
        status : PaymentStatus;
        createdAt : Time.Time;
        fee : Nat;
        netAmount : Nat;
    };

    public type PaymentStatus = {
        #pending;
        #completed;
        #disputed;
    };

    var payments = textMap.empty<Payment>();

    var platformFeePercentage : Nat = 5;

    public shared ({ caller }) func setPlatformFeePercentage(percentage : Nat) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
            Debug.trap("Unauthorized: Only admins can set platform fee percentage");
        };
        platformFeePercentage := percentage;
    };

    public query func getPlatformFeePercentage() : async Nat {
        platformFeePercentage;
    };

    public shared ({ caller }) func markTaskCompleted(taskId : Text) : async () {
        let task = textMap.get(tasks, taskId);
        switch (task) {
            case null Debug.trap("Task not found");
            case (?t) {
                if (t.requester != caller) {
                    Debug.trap("Unauthorized: Only task owner can mark task as completed");
                };

                let updatedTask : Task = {
                    t with status = #completed;
                };
                tasks := textMap.put(tasks, taskId, updatedTask);

                let approvedOffer = Iter.toArray(
                    Iter.filter(
                        textMap.vals(offers),
                        func(o : Offer) : Bool {
                            o.taskId == taskId and o.status == #approved;
                        },
                    )
                );

                if (approvedOffer.size() == 0) {
                    Debug.trap("No approved offer found for this task");
                };

                let offer = approvedOffer[0];

                let fee = if (offer.price >= 20) offer.price * platformFeePercentage / 100 else 0;
                let netAmount = Nat.sub(offer.price, fee);

                let payment : Payment = {
                    id = taskId # "_payment";
                    taskId = taskId;
                    amount = offer.price;
                    tasker = offer.tasker;
                    requester = caller;
                    status = #completed;
                    createdAt = Time.now();
                    fee = fee;
                    netAmount = netAmount;
                };
                payments := textMap.put(payments, payment.id, payment);

                let notification : Notification = {
                    id = taskId # "_payment";
                    userId = offer.tasker;
                    offerId = ?offer.id;
                    taskId = ?taskId;
                    notificationType = #taskUpdate;
                    createdAt = Time.now();
                    isRead = false;
                    principal = Principal.toText(caller);
                };
                notifications := textMap.put(notifications, notification.id, notification);
            };
        };
    };

    public query func getPayments() : async [Payment] {
        Iter.toArray(textMap.vals(payments));
    };

    public query func getTasksWithinRadius(latitude : Float, longitude : Float, radiusKm : Float) : async [Task] {
        let tasksArray = Iter.toArray(textMap.vals(tasks));
        let filteredTasks = Array.filter<Task>(
            tasksArray,
            func(task : Task) : Bool {
                let distance = calculateDistance(latitude, longitude, task.latitude, task.longitude);
                distance <= radiusKm;
            },
        );
        filteredTasks;
    };

    func calculateDistance(lat1 : Float, lon1 : Float, lat2 : Float, lon2 : Float) : Float {
        let earthRadius = 6371.0;
        let dLat = degreesToRadians(lat2 - lat1);
        let dLon = degreesToRadians(lon2 - lon1);

        let a = Float.sin(dLat / 2.0) ** 2.0 + Float.cos(degreesToRadians(lat1)) * Float.cos(degreesToRadians(lat2)) * Float.sin(dLon / 2.0) ** 2.0;
        let c = 2.0 * Float.arctan2(Float.sqrt(a), Float.sqrt(1.0 - a));
        earthRadius * c;
    };

    func degreesToRadians(degrees : Float) : Float {
        degrees * 3.141592653589793 / 180.0;
    };

    public shared ({ caller }) func addAccreditation(accreditation : Accreditation) : async () {
        let profile = principalMap.get(userProfiles, caller);
        switch (profile) {
            case null Debug.trap("Profile not found");
            case (?p) {
                let updatedAccreditations = Array.append(p.accreditations, [accreditation]);
                let updatedProfile : UserProfile = {
                    p with accreditations = updatedAccreditations;
                };
                userProfiles := principalMap.put(userProfiles, caller, updatedProfile);
            };
        };
    };

    public shared ({ caller }) func removeAccreditation(accreditationId : Text) : async () {
        let profile = principalMap.get(userProfiles, caller);
        switch (profile) {
            case null Debug.trap("Profile not found");
            case (?p) {
                let filteredAccreditations = Array.filter<Accreditation>(
                    p.accreditations,
                    func(a : Accreditation) : Bool {
                        a.id != accreditationId;
                    },
                );
                let updatedProfile : UserProfile = {
                    p with accreditations = filteredAccreditations;
                };
                userProfiles := principalMap.put(userProfiles, caller, updatedProfile);
            };
        };
    };

    public shared ({ caller }) func updateAccreditation(updatedAccreditation : Accreditation) : async () {
        let profile = principalMap.get(userProfiles, caller);
        switch (profile) {
            case null Debug.trap("Profile not found");
            case (?p) {
                let updatedAccreditations = Array.map<Accreditation, Accreditation>(
                    p.accreditations,
                    func(a : Accreditation) : Accreditation {
                        if (a.id == updatedAccreditation.id) {
                            updatedAccreditation;
                        } else {
                            a;
                        };
                    },
                );
                let updatedProfile : UserProfile = {
                    p with accreditations = updatedAccreditations;
                };
                userProfiles := principalMap.put(userProfiles, caller, updatedProfile);
            };
        };
    };

    public type FeedPostType = Feed.FeedPostType;
    public type FeedPost = Feed.FeedPost;
    public type SwapStatus = Feed.SwapStatus;

    var feedPosts = textMap.empty<FeedPost>();

    public shared ({ caller }) func createFeedPost(post : FeedPost) : async () {
        if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
            Debug.trap("Unauthorized: Only users can create feed posts");
        };

        if (not areFeedTimeSlotsUnique(post.availabilityCalendar)) {
            Debug.trap("Duplicate time slots found in availability calendar");
        };

        feedPosts := textMap.put(feedPosts, post.id, post);
    };

    func areFeedTimeSlotsUnique(calendar : ?AvailabilityCalendar) : Bool {
        switch (calendar) {
            case null true;
            case (?cal) {
                let timeSlots = cal.timeSlots;
                for (i in Iter.range(0, timeSlots.size() - 1)) {
                    for (j in Iter.range(i + 1, timeSlots.size() - 1)) {
                        if (timeSlots[i].startTime == timeSlots[j].startTime and timeSlots[i].endTime == timeSlots[j].endTime) {
                            return false;
                        };
                    };
                };
                true;
            };
        };
    };

    public query func getFeedPosts() : async [FeedPost] {
        Iter.toArray(textMap.vals(feedPosts));
    };

    public query func getFeedPostsByType(postType : FeedPostType) : async [FeedPost] {
        Iter.toArray(
            Iter.filter(
                textMap.vals(feedPosts),
                func(p : FeedPost) : Bool {
                    p.postType == postType;
                },
            )
        );
    };

    public query func getFeedPostsWithinRadius(latitude : Float, longitude : Float, radiusKm : Nat) : async [FeedPost] {
        let postsArray = Iter.toArray(textMap.vals(feedPosts));
        let filteredPosts = Array.filter<FeedPost>(
            postsArray,
            func(post : FeedPost) : Bool {
                let distance = calculateDistance(latitude, longitude, post.latitude, post.longitude);
                distance <= Float.fromInt(radiusKm);
            },
        );
        filteredPosts;
    };

    public shared ({ caller }) func claimVolunteerSlot(postId : Text) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.postType != #volunteerSlotpack) {
                    Debug.trap("Not a volunteer slot pack post");
                };
                if (p.claimedSlots >= p.availableSlots) {
                    Debug.trap("No available slots");
                };
                let updatedPost : FeedPost = {
                    p with claimedSlots = p.claimedSlots + 1;
                };
                feedPosts := textMap.put(feedPosts, postId, updatedPost);
            };
        };
    };

    public shared ({ caller }) func markFeedPostInactive(postId : Text) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.creator != caller) {
                    Debug.trap("Unauthorized: Only post creator can mark inactive");
                };
                let updatedPost : FeedPost = {
                    p with isActive = false;
                };
                feedPosts := textMap.put(feedPosts, postId, updatedPost);
            };
        };
    };

    public shared ({ caller }) func markFeedPostActive(postId : Text) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.creator != caller) {
                    Debug.trap("Unauthorized: Only post creator can mark active");
                };
                let updatedPost : FeedPost = {
                    p with isActive = true;
                };
                feedPosts := textMap.put(feedPosts, postId, updatedPost);
            };
        };
    };

    public query func getActiveFeedPosts() : async [FeedPost] {
        Iter.toArray(
            Iter.filter(
                textMap.vals(feedPosts),
                func(p : FeedPost) : Bool {
                    p.isActive;
                },
            )
        );
    };

    public query func getInactiveFeedPosts() : async [FeedPost] {
        Iter.toArray(
            Iter.filter(
                textMap.vals(feedPosts),
                func(p : FeedPost) : Bool {
                    not p.isActive;
                },
            )
        );
    };

    public shared ({ caller }) func deleteFeedPost(postId : Text) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.creator != caller) {
                    Debug.trap("Unauthorized: Only post creator can delete");
                };
                feedPosts := textMap.delete(feedPosts, postId);
            };
        };
    };

    public shared ({ caller }) func claimSwap(postId : Text) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.postType != #swap) {
                    Debug.trap("Not a swap post");
                };

                if (p.status == #closed) {
                    Debug.trap("Swap post is closed and cannot be claimed");
                };

                if (p.status != #open) {
                    Debug.trap("Swap post is not open for claiming");
                };

                let claimingUserProfile = principalMap.get(userProfiles, caller);
                let claimingUserName = switch (claimingUserProfile) {
                    case null Principal.toText(caller);
                    case (?profile) profile.displayName;
                };

                let updatedPost : FeedPost = {
                    p with status = #pending;
                };
                feedPosts := textMap.put(feedPosts, postId, updatedPost);

                if (p.creator != caller) {
                    let notification : Notification = {
                        id = postId # "_swap_claim_" # Principal.toText(caller);
                        userId = p.creator;
                        offerId = null;
                        taskId = null;
                        notificationType = #swapClaim;
                        createdAt = Time.now();
                        isRead = false;
                        principal = claimingUserName;
                    };
                    notifications := textMap.put(notifications, notification.id, notification);
                };
            };
        };
    };

    public shared ({ caller }) func approveSwapClaim(postId : Text, claimant : Principal) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.creator != caller) {
                    Debug.trap("Unauthorized: Only post owner can approve swap claims");
                };

                let updatedPost : FeedPost = {
                    p with status = #assigned;
                };
                feedPosts := textMap.put(feedPosts, postId, updatedPost);

                let notification : Notification = {
                    id = postId # "_swap_approved_" # Principal.toText(claimant);
                    userId = claimant;
                    offerId = null;
                    taskId = null;
                    notificationType = #swapClaim;
                    createdAt = Time.now();
                    isRead = false;
                    principal = Principal.toText(caller);
                };
                notifications := textMap.put(notifications, notification.id, notification);

                let statusChangeNotification : Notification = {
                    id = postId # "_swap_status_assigned_" # Principal.toText(claimant);
                    userId = claimant;
                    offerId = null;
                    taskId = null;
                    notificationType = #swapStatusChange;
                    createdAt = Time.now();
                    isRead = false;
                    principal = Principal.toText(caller);
                };
                notifications := textMap.put(notifications, statusChangeNotification.id, statusChangeNotification);
            };
        };
    };

    public shared ({ caller }) func rejectSwapClaim(postId : Text, claimant : Principal) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.creator != caller) {
                    Debug.trap("Unauthorized: Only post owner can reject swap claims");
                };

                let updatedPost : FeedPost = {
                    p with status = #open;
                };
                feedPosts := textMap.put(feedPosts, postId, updatedPost);

                let notification : Notification = {
                    id = postId # "_swap_rejected_" # Principal.toText(claimant);
                    userId = claimant;
                    offerId = null;
                    taskId = null;
                    notificationType = #swapClaim;
                    createdAt = Time.now();
                    isRead = false;
                    principal = Principal.toText(caller);
                };
                notifications := textMap.put(notifications, notification.id, notification);

                let statusChangeNotification : Notification = {
                    id = postId # "_swap_status_open_" # Principal.toText(claimant);
                    userId = claimant;
                    offerId = null;
                    taskId = null;
                    notificationType = #swapStatusChange;
                    createdAt = Time.now();
                    isRead = false;
                    principal = Principal.toText(caller);
                };
                notifications := textMap.put(notifications, statusChangeNotification.id, statusChangeNotification);
            };
        };
    };

    public shared ({ caller }) func markSwapCompleted(postId : Text, claimant : Principal) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.creator != caller) {
                    Debug.trap("Unauthorized: Only post owner can mark swap as completed");
                };

                let updatedPost : FeedPost = {
                    p with status = #closed;
                };
                feedPosts := textMap.put(feedPosts, postId, updatedPost);

                let statusChangeNotification : Notification = {
                    id = postId # "_swap_status_completed_" # Principal.toText(claimant);
                    userId = claimant;
                    offerId = null;
                    taskId = null;
                    notificationType = #swapStatusChange;
                    createdAt = Time.now();
                    isRead = false;
                    principal = Principal.toText(caller);
                };
                notifications := textMap.put(notifications, statusChangeNotification.id, statusChangeNotification);
            };
        };
    };

    public shared ({ caller }) func markSwapDidNotOccur(postId : Text) : async () {
        let post = textMap.get(feedPosts, postId);
        switch (post) {
            case null Debug.trap("Post not found");
            case (?p) {
                if (p.creator != caller) {
                    Debug.trap("Unauthorized: Only post owner can mark swap as did not occur");
                };

                let updatedPost : FeedPost = {
                    p with status = #open;
                };
                feedPosts := textMap.put(feedPosts, postId, updatedPost);

                let statusChangeNotification : Notification = {
                    id = postId # "_swap_status_open_" # Principal.toText(caller);
                    userId = p.creator;
                    offerId = null;
                    taskId = null;
                    notificationType = #swapStatusChange;
                    createdAt = Time.now();
                    isRead = false;
                    principal = Principal.toText(caller);
                };
                notifications := textMap.put(notifications, statusChangeNotification.id, statusChangeNotification);
            };
        };
    };
};
