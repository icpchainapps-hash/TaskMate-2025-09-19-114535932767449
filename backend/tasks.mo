import Time "mo:base/Time";
import Principal "mo:base/Principal";

module {
    public type TaskStatus = {
        #open;
        #assigned;
        #inProgress;
        #completed;
        #disputed;
    };

    public type TaskType = {
        #paid;
        #volunteer;
    };

    public type TimeSlot = {
        startTime : Time.Time;
        endTime : Time.Time;
    };

    public type AvailabilityCalendar = {
        availableDates : [Time.Time];
        timeSlots : [TimeSlot];
        durationMinutes : Nat;
        intervalMinutes : Nat;
    };

    public type Task = {
        id : Text;
        title : Text;
        description : Text;
        category : Text;
        budget : Nat;
        dueDate : Time.Time;
        requiredSkills : [Text];
        status : TaskStatus;
        requester : Principal;
        assignedTasker : ?Principal;
        createdAt : Time.Time;
        images : [Text];
        isArchived : Bool;
        address : Text;
        latitude : Float;
        longitude : Float;
        taskType : TaskType;
        availabilityCalendar : AvailabilityCalendar;
    };
};

