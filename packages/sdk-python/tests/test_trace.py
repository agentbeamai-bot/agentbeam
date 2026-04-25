import agentbeam
from agentbeam.trace import trace


def test_trace_decorator():
    """Test that @trace decorator wraps function correctly."""

    @trace(name="test_func", kind="custom")
    def my_func(x, y):
        return x + y

    # Can't call without init, but verify decoration preserves function
    assert my_func.__name__ == "my_func"
