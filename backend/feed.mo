import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Tasks "tasks";

module {
    public type FeedPostType = {
        #taskPromo;
        #swap;
        #freecycle;
        #notice;
        #volunteerSlotpack;
    };

    public type SwapStatus = {
        #open;
        #pending;
        #assigned;
        #closed;
    };

    public type FeedPost = {
        id : Text;
        postType : FeedPostType;
        title : Text;
        description : Text;
        creator : Principal;
        createdAt : Time.Time;
        location : Text;
        latitude : Float;
        longitude : Float;
        visibilityRadius : Nat;
        taskId : ?Text;
        availableSlots : Nat;
        claimedSlots : Nat;
        isActive : Bool;
        availabilityCalendar : ?Tasks.AvailabilityCalendar;
        status : SwapStatus;
    };
};

