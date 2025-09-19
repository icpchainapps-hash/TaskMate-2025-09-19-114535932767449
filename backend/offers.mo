import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Tasks "tasks";

module {
    public type OfferStatus = {
        #pending;
        #approved;
        #rejected;
    };

    public type Offer = {
        id : Text;
        taskId : Text;
        tasker : Principal;
        price : Nat;
        message : Text;
        createdAt : Time.Time;
        status : OfferStatus;
        selectedTimeSlot : ?Tasks.TimeSlot;
    };
};
